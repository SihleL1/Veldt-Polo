-- 002_functions.sql — server-side logic. Every write rule lives here so the
-- client cannot bypass it: sequence assignment, score reconciliation, undo
-- reversal, clock persistence and role administration.

-- ---------- role helpers ----------
create or replace function has_role(p_role text, p_user uuid default auth.uid())
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from role_assignments
    where user_id = p_user and role = p_role
  );
$$;

-- ---------- views ----------
create or replace view tournaments_with_counts as
select
  t.*,
  s.name as season_name,
  (select count(*) from tournament_entries e where e.tournament_id = t.id) as entry_count
from tournaments t join seasons s on s.id = t.season_id;

create or replace view user_profiles_with_roles as
select
  p.id, p.email, p.name, p.school_id, p.created_at,
  coalesce(
    (select array_agg(r.role order by r.role) from role_assignments r where r.user_id = p.id),
    array[]::text[]
  ) as roles
from user_profiles p;

-- ---------- clock ----------
create or replace function persist_match_clock(
  p_match_id uuid, p_clock jsonb, p_possession text, p_status text
) returns matches language plpgsql security definer as $$
declare
  m matches;
begin
  if not has_role('scorekeeper') and not has_role('tournament_admin') and not has_role('admin') then
    raise exception 'Not authorised to operate the scoring console';
  end if;
  update matches set
    clock = p_clock,
    possession = p_possession,
    status = p_status,
    started_at = case when p_status in ('live','paused') and started_at is null then now() else started_at end,
    ended_at   = case when p_status = 'completed' then coalesce(ended_at, now()) else ended_at end,
    updated_at = now()
  where id = p_match_id
  returning * into m;
  if m is null then raise exception 'Match not found'; end if;
  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (auth.uid()::text, coalesce((select name from user_profiles where id = auth.uid()), 'operator'),
          'match.clock', 'match', p_match_id::text,
          format('clock persisted: status=%s elapsed=%s period=%s', p_status, p_clock->>'elapsed_ms', p_clock->>'period'));
  return m;
end;
$$;

-- ---------- events ----------
create or replace function record_match_event(p_event jsonb, p_operator text)
returns jsonb language plpgsql security definer as $$
declare
  v_match matches;
  v_seq   integer;
  v_row   match_events;
  v_goal  boolean;
  v_def   event_types%rowtype;
begin
  if not has_role('scorekeeper') and not has_role('tournament_admin') and not has_role('admin') then
    raise exception 'Not authorised to record events';
  end if;
  if p_event->>'status' is not null then
    -- ignore extraneous keys
  end if;

  select * into v_match from matches where id = (p_event->>'match_id')::uuid;
  if v_match is null then raise exception 'Match not found'; end if;
  if v_match.status = 'completed' then raise exception 'Match is finalised'; end if;

  select * into v_def from event_types where type = p_event->>'event_type';
  if not found then raise exception 'Unknown event type'; end if;
  v_goal := v_def.scores;

  -- Idempotent retry: same client UUID returns the stored event unchanged.
  select * into v_row from match_events where id = (p_event->>'id')::uuid;
  if found then
    return jsonb_build_object('event', to_jsonb(v_row), 'match', to_jsonb(v_match));
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from match_events where match_id = v_match.id;

  insert into match_events (id, match_id, seq, period, game_clock_ms, team_id, player_id,
                            player_cap, secondary_player_id, category, event_type, outcome, created_by)
  values (
    (p_event->>'id')::uuid, v_match.id, v_seq,
    (p_event->>'period')::int,
    (p_event->>'game_clock_ms')::int,
    nullif(p_event->>'team_id', '')::uuid,
    nullif(p_event->>'player_id', '')::uuid,
    nullif(p_event->>'player_cap', '')::int,
    nullif(p_event->>'secondary_player_id', '')::uuid,
    p_event->>'category', p_event->>'event_type', p_event->>'outcome', p_operator
  ) returning * into v_row;

  -- Score consequences live ONLY here, inside the same transaction as the event.
  if v_goal and v_row.team_id is not null then
    update matches set
      home_score = home_score + case when v_row.team_id = v_match.home_team_id then 1 else 0 end,
      away_score = away_score + case when v_row.team_id = v_match.away_team_id then 1 else 0 end,
      updated_at = now()
    where id = v_match.id returning * into v_match;
  end if;

  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_operator, coalesce((select name from user_profiles where id = nullif(p_operator,'')::uuid), p_operator),
          'event.record', 'match_event', v_row.id::text,
          format('%s Q%s %sms cap %s team %s', v_row.event_type, v_row.period, v_row.game_clock_ms, v_row.player_cap, v_row.team_id));

  return jsonb_build_object('event', to_jsonb(v_row), 'match', to_jsonb(v_match));
end;
$$;

create or replace function undo_match_event(p_event_id uuid, p_reason text, p_actor text)
returns jsonb language plpgsql security definer as $$
declare
  v_row match_events;
  v_match matches;
begin
  if not has_role('scorekeeper') and not has_role('tournament_admin') and not has_role('admin') then
    raise exception 'Not authorised to undo events';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A correction reason is required';
  end if;

  select * into v_row from match_events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_row.deleted_at is not null then raise exception 'Event already undone'; end if;

  select * into v_match from matches where id = v_row.match_id;
  if v_match.status = 'completed' then raise exception 'Match is finalised'; end if;

  update match_events set deleted_at = now(), correction_reason = p_reason where id = p_event_id;

  -- Reverse score consequences exactly when the event scored.
  if exists (select 1 from event_types where type = v_row.event_type and scores) and v_row.team_id is not null then
    update matches set
      home_score = greatest(home_score - case when v_row.team_id = v_match.home_team_id then 1 else 0 end, 0),
      away_score = greatest(away_score - case when v_row.team_id = v_match.away_team_id then 1 else 0 end, 0),
      updated_at = now()
    where id = v_row.match_id returning * into v_match;
  end if;

  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_actor, coalesce((select name from user_profiles where id = nullif(p_actor,'')::uuid), p_actor),
          'event.undo', 'match_event', p_event_id::text, p_reason);

  return jsonb_build_object('event', to_jsonb(v_row), 'match', to_jsonb(v_match));
end;
$$;

-- ---------- finalisation & verification ----------
create or replace function finalise_match(p_match_id uuid, p_actor text)
returns matches language plpgsql security definer as $$
declare
  m matches;
  recorded integer;
  expected integer;
begin
  if not has_role('scorekeeper') and not has_role('tournament_admin') and not has_role('admin') then
    raise exception 'Not authorised to finalise matches';
  end if;
  select * into m from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if m.status = 'completed' then return m; end if;

  select coalesce(sum(case when me.team_id = m.home_team_id then 1 else 0 end
                         + case when me.team_id = m.away_team_id then 1 else 0 end), 0)
    into recorded
  from match_events me join event_types et on et.type = me.event_type
  where me.match_id = p_match_id and me.deleted_at is null and et.scores;

  expected := m.home_score + m.away_score;

  if recorded > 0 and recorded <> expected then
    raise exception 'Score does not reconcile: % goals recorded as events, score says %. Undo or correct events first.',
      recorded, expected;
  end if;

  update matches set status = 'completed', ended_at = coalesce(ended_at, now()),
                     clock = clock || '{"running_since": null, "shot_running_since": null}'::jsonb,
                     updated_at = now()
  where id = p_match_id returning * into m;

  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_actor, coalesce((select name from user_profiles where id = nullif(p_actor,'')::uuid), p_actor),
          'match.finalise', 'match', p_match_id::text, format('finalised %s–%s (%s goal events)', m.home_score, m.away_score, recorded));

  return m;
end;
$$;

create or replace function set_match_verification(p_match_id uuid, p_verification text, p_reason text, p_actor text)
returns matches language plpgsql security definer as $$
declare
  m matches;
begin
  if not has_role('admin') and not has_role('tournament_admin') then
    raise exception 'Only administrators may set result verification';
  end if;
  if p_verification not in ('unverified','verified','disputed') then raise exception 'Invalid verification'; end if;
  update matches set verification = p_verification, updated_at = now()
  where id = p_match_id returning * into m;
  if not found then raise exception 'Match not found'; end if;
  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_actor, coalesce((select name from user_profiles where id = nullif(p_actor,'')::uuid), p_actor),
          'match.verification', 'match', p_match_id::text, format('%s — %s', p_verification, p_reason));
  return m;
end;
$$;

-- ---------- user administration ----------
create or replace function set_user_roles(p_user uuid, p_roles text[], p_actor text, p_actor_name text)
returns void language plpgsql security definer as $$
begin
  if not has_role('admin') then raise exception 'Only administrators may change roles'; end if;
  delete from role_assignments where user_id = p_user
    and role not in (select unnest(p_roles));
  insert into role_assignments (user_id, role, granted_by)
  select p_user, r, p_actor from unnest(p_roles) as r
  on conflict (user_id, role) do nothing;
  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_actor, p_actor_name, 'user.roles', 'user_profile', p_user::text,
          format('roles set to %s', array_to_string(p_roles, ', ')));
end;
$$;

create or replace function invite_user(p_email text, p_name text, p_roles text[], p_actor text, p_actor_name text)
returns user_profiles language plpgsql security definer as $$
declare
  u user_profiles;
begin
  if not has_role('admin') then raise exception 'Only administrators may invite users'; end if;
  insert into user_profiles (id, email, name)
  values (gen_random_uuid(), lower(trim(p_email)), coalesce(p_name, ''))
  on conflict (email) do update set name = coalesce(nullif(excluded.name, ''), user_profiles.name)
  returning * into u;

  delete from role_assignments where user_id = u.id and role not in (select unnest(p_roles));
  insert into role_assignments (user_id, role, granted_by)
  select u.id, r, p_actor from unnest(p_roles) as r
  on conflict (user_id, role) do nothing;

  insert into audit_logs (actor_id, actor_name, action, entity, entity_id, detail)
  values (p_actor, p_actor_name, 'user.invite', 'user_profile', u.id::text,
          format('Invited %s (%s) as %s', u.name, u.email, array_to_string(p_roles, ', ')));
  return u;
end;
$$;

-- ---------- lookup ----------
create or replace function get_school_by_slug_or_id(key text)
returns setof schools language sql security definer stable as $$
  select * from schools where slug = key or id::text = key
$$;
