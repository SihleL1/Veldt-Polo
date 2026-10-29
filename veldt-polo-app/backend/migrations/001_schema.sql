-- 001_schema.sql — Schools Water Polo South Africa
-- Core schema. Apply with: supabase db push  (or psql) in order 001..004.
-- Native Supabase Auth: user_profiles.id mirrors auth.users.id (auth.uid()).

create extension if not exists "pgcrypto";

-- ---------- updated_at helper ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- schools ----------
create table if not exists schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  province    text not null default 'Unknown',
  city        text not null default '',
  type        text,
  logo_url    text,
  website_url text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger schools_updated_at before update on schools
  for each row execute function set_updated_at();

-- ---------- teams ----------
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete restrict,
  name       text not null,
  category   text not null,           -- e.g. first_team_boys
  age_group  text not null default 'U19',
  gender     text not null default 'mixed' check (gender in ('boys','girls','mixed')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_school_idx on teams(school_id);
create index if not exists teams_category_idx on teams(category);
create trigger teams_updated_at before update on teams
  for each row execute function set_updated_at();

-- ---------- seasons ----------
create table if not exists seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  created_at timestamptz not null default now(),
  constraint seasons_dates_check check (end_date >= start_date)
);

-- ---------- tournaments ----------
create table if not exists tournaments (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique,
  season_id          uuid not null references seasons(id) on delete restrict,
  category           text not null,
  start_date         date not null,
  end_date           date not null,
  venue              text not null default '',
  province           text not null default '',
  status             text not null default 'scheduled' check (status in ('scheduled','active','completed','cancelled')),
  published          boolean not null default false,
  periods            integer not null default 4 check (periods between 1 and 8),
  period_length_min  integer not null default 7 check (period_length_min between 1 and 30),
  shot_clock_seconds integer not null default 30 check (shot_clock_seconds between 10 and 60),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists tournaments_season_idx on tournaments(season_id);
create trigger tournaments_updated_at before update on tournaments
  for each row execute function set_updated_at();

-- ---------- tournament entries & pools ----------
create table if not exists tournament_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  group_name    text,
  seed          integer,
  unique (tournament_id, team_id)
);
create index if not exists entries_tournament_idx on tournament_entries(tournament_id);

create table if not exists pool_groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  category      text not null,
  display_order integer not null default 0
);

-- ---------- matches ----------
create table if not exists matches (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references tournaments(id) on delete restrict,
  season_id        uuid not null references seasons(id) on delete restrict,
  home_team_id     uuid not null references teams(id) on delete restrict,
  away_team_id     uuid not null references teams(id) on delete restrict,
  scheduled_at     timestamptz not null,
  venue            text not null default '',
  round            text,
  pool_group_id    uuid references pool_groups(id) on delete set null,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','live','paused','completed','abandoned','postponed')),
  home_score       integer not null default 0 check (home_score >= 0),
  away_score       integer not null default 0 check (away_score >= 0),
  clock            jsonb   not null default '{}'::jsonb,
  possession       text check (possession in ('home','away')),
  started_at       timestamptz,
  ended_at         timestamptz,
  verification     text not null default 'unverified' check (verification in ('unverified','verified','disputed')),
  periods          integer not null default 4,
  period_length_ms integer not null default 420000,
  shot_clock_ms    integer not null default 30000,
  flagged          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint matches_teams_distinct check (home_team_id <> away_team_id)
);
create index if not exists matches_season_idx on matches(season_id);
create index if not exists matches_tournament_idx on matches(tournament_id);
create index if not exists matches_status_idx on matches(status);
create index if not exists matches_home_idx on matches(home_team_id);
create index if not exists matches_away_idx on matches(away_team_id);
create index if not exists matches_scheduled_idx on matches(scheduled_at);
create trigger matches_updated_at before update on matches
  for each row execute function set_updated_at();

-- ---------- players & rosters ----------
create table if not exists players (
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name      text not null,
  position  text,
  active    boolean not null default true
);
create index if not exists players_school_idx on players(school_id);

create table if not exists team_rosters (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  season_id     uuid not null references seasons(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  cap_number    integer not null check (cap_number between 1 and 13),
  is_goalkeeper boolean not null default false,
  unique (team_id, season_id, cap_number)
);

-- ---------- event catalogue ----------
create table if not exists event_types (
  type              text primary key,
  label             text not null,
  category          text not null check (category in ('scoring','shooting','fouls','possession','attack','control')),
  scores            boolean not null default false,
  resets_shot_clock boolean not null default false,
  defensive         boolean not null default false,
  description       text not null default ''
);

-- ---------- match events (auditable, soft-deletable) ----------
create table if not exists match_events (
  id                  uuid primary key,             -- client-generated UUID: idempotent retries
  match_id            uuid not null references matches(id) on delete cascade,
  seq                 integer not null,             -- authoritative order, assigned server-side
  period              integer not null check (period between 1 and 8),
  game_clock_ms       integer not null default 0 check (game_clock_ms >= 0),  -- ms remaining in period
  team_id             uuid references teams(id) on delete set null,
  player_id           uuid references players(id) on delete set null,
  player_cap          integer,
  secondary_player_id uuid references players(id) on delete set null,
  category            text not null,
  event_type          text not null references event_types(type),
  outcome             text,
  created_by          text not null,
  recorded_at         timestamptz not null default now(),
  deleted_at          timestamptz,
  correction_reason   text
);
create index if not exists events_match_idx on match_events(match_id, seq);
create unique index if not exists events_match_seq_idx on match_events(match_id, seq);

-- ---------- ranking configs & snapshots ----------
create table if not exists ranking_configs (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id) on delete restrict,
  category          text not null,
  version           integer not null default 1,
  win_rate_weight   numeric not null default 0.6 check (win_rate_weight >= 0),
  offensive_weight  numeric not null default 0.2 check (offensive_weight >= 0),
  defensive_weight  numeric not null default 0.2 check (defensive_weight >= 0),
  draw_value        numeric not null default 0.5 check (draw_value >= 0 and draw_value <= 1),
  min_games         integer not null default 6 check (min_games >= 1),
  status            text not null default 'draft' check (status in ('draft','published')),
  effective_from    date not null default current_date,
  created_by        text,
  created_at        timestamptz not null default now(),
  unique (season_id, category, version)
);

create table if not exists ranking_snapshots (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete restrict,
  category       text not null,
  config_id      uuid not null references ranking_configs(id) on delete restrict,
  config_version integer not null,
  calculated_at  timestamptz not null default now(),
  published      boolean not null default false,
  rows           jsonb not null        -- RankingRow[] as computed by the tested engine
);
create index if not exists snapshots_lookup_idx on ranking_snapshots(season_id, category, calculated_at desc);

-- ---------- users & roles ----------
create table if not exists user_profiles (
  id         uuid primary key,               -- = auth.users.id
  email      text not null unique,
  name       text not null default '',
  school_id  uuid references schools(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists role_assignments (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references user_profiles(id) on delete cascade,
  role      text not null check (role in ('admin','tournament_admin','scorekeeper','coach','analyst')),
  granted_by text,
  unique (user_id, role)
);
create index if not exists role_user_idx on role_assignments(user_id);

-- ---------- audit log ----------
create table if not exists audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   text,
  actor_name text not null default '',
  action     text not null,
  entity     text not null,
  entity_id  text,
  detail     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on audit_logs(created_at desc);
