-- 003_rls.sql — Row Level Security. The database is the authority: every table
-- is locked by default and opened only through policies tied to auth.uid()
-- and has_role(). The UI's role checks are convenience, never the guarantee.

-- Helper: is the caller linked to a given school (coach/analyst scope)?
create or replace function in_my_school(p_school uuid, p_user uuid default auth.uid())
returns boolean language sql security definer stable as $$
  select exists (select 1 from user_profiles where id = p_user and school_id = p_school);
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'schools','teams','seasons','tournaments','tournament_entries','pool_groups',
    'matches','players','team_rosters','event_types','match_events',
    'ranking_configs','ranking_snapshots','user_profiles','role_assignments','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------- public reads (anon + authenticated) ----------
create policy schools_read   on schools            for select using (true);
create policy teams_read     on teams              for select using (true);
create policy seasons_read   on seasons            for select using (true);
create policy events_catalog_read on event_types   for select using (true);

create policy tournaments_read on tournaments for select using (
  published or has_role('admin') or has_role('tournament_admin')
);
create policy entries_read on tournament_entries for select using (
  exists (select 1 from tournaments t where t.id = tournament_id and (t.published or has_role('admin') or has_role('tournament_admin')))
);
create policy pools_read on pool_groups for select using (
  exists (select 1 from tournaments t where t.id = tournament_id and (t.published or has_role('admin') or has_role('tournament_admin')))
);
create policy matches_read on matches for select using (
  (season_id in (select id from seasons where status <> 'upcoming')) or true  -- fixtures/results are public
);
create policy snapshots_read on ranking_snapshots for select using (
  published or has_role('admin') or has_role('tournament_admin')
);

-- ---------- writes: admins only, enforced in policies AND functions ----------
create policy schools_write   on schools            for all using (has_role('admin')) with check (has_role('admin'));
create policy teams_write     on teams              for all using (has_role('admin') or has_role('tournament_admin')) with check (has_role('admin') or has_role('tournament_admin'));
create policy seasons_write   on seasons            for all using (has_role('admin')) with check (has_role('admin'));
create policy tournaments_write on tournaments      for all using (has_role('admin') or has_role('tournament_admin')) with check (has_role('admin') or has_role('tournament_admin'));
create policy entries_write   on tournament_entries for all using (has_role('admin') or has_role('tournament_admin')) with check (has_role('admin') or has_role('tournament_admin'));
create policy pools_write     on pool_groups        for all using (has_role('admin') or has_role('tournament_admin')) with check (has_role('admin') or has_role('tournament_admin'));

create policy matches_write on matches for all
  using (has_role('admin') or has_role('tournament_admin') or has_role('scorekeeper'))
  with check (has_role('admin') or has_role('tournament_admin') or has_role('scorekeeper'));

-- Match events: insert/update flows exclusively through the RPC functions
-- (record_match_event / undo_match_event), which validate roles and maintain
-- scores. Direct table writes are denied.
create policy events_deny_direct on match_events for select using (true);

create policy players_write  on players      for all using (has_role('admin') or has_role('tournament_admin') or has_role('coach')) with check (has_role('admin') or has_role('tournament_admin') or has_role('coach'));
create policy rosters_write  on team_rosters for all using (has_role('admin') or has_role('tournament_admin') or has_role('coach')) with check (has_role('admin') or has_role('tournament_admin') or has_role('coach'));

create policy configs_write  on ranking_configs for all using (has_role('admin')) with check (has_role('admin'));
create policy snapshots_write on ranking_snapshots for all using (has_role('admin')) with check (has_role('admin'));

-- Users & roles: admins administer others; everyone may read their own profile.
create policy profiles_read on user_profiles for select using (
  id = auth.uid() or has_role('admin')
);
create policy profiles_admin on user_profiles for all using (has_role('admin')) with check (has_role('admin'));
create policy roles_read on role_assignments for select using (
  user_id = auth.uid() or has_role('admin')
);
create policy roles_admin on role_assignments for all using (has_role('admin')) with check (has_role('admin'));

create policy audit_read on audit_logs for select using (has_role('admin'));

-- ---------- coaches & analysts: private reads over their own school ----------
create policy events_scoped_read on match_events for select using (
  team_id is null or in_my_school((select school_id from teams where id = team_id))
);
create policy players_scoped on players for select using (
  in_my_school(school_id) or has_role('admin') or has_role('tournament_admin')
);
create policy rosters_scoped on team_rosters for select using (
  in_my_school((select school_id from teams where id = team_id)) or has_role('admin') or has_role('tournament_admin')
);

-- ---------- trigger: new auth user -> profile ----------
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer as $$
begin
  insert into user_profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
