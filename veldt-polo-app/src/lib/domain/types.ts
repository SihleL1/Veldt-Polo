/**
 * Domain model for Schools Water Polo South Africa.
 * Pure types only — no persistence or UI concerns.
 */

export type Role = "admin" | "tournament_admin" | "scorekeeper" | "coach" | "analyst";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Platform administrator",
  tournament_admin: "Tournament administrator",
  scorekeeper: "Scorekeeper / match operator",
  coach: "Coach / school representative",
  analyst: "Analyst",
};

export interface School {
  id: string;
  name: string;
  slug: string;
  province: string;
  city: string;
  type: string | null;
  logo_url: string | null;
  website_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type TeamCategory = "first_team_boys" | "first_team_girls" | (string & {});

export const TEAM_CATEGORIES: { id: TeamCategory; label: string; gender: "boys" | "girls" }[] = [
  { id: "first_team_boys", label: "First Team Boys", gender: "boys" },
  { id: "first_team_girls", label: "First Team Girls", gender: "girls" },
];

export const categoryLabel = (c: string): string =>
  TEAM_CATEGORIES.find((t) => t.id === c)?.label ?? c;

export interface Team {
  id: string;
  school_id: string;
  name: string;
  category: TeamCategory;
  age_group: string;
  gender: "boys" | "girls" | "mixed";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type SeasonStatus = "upcoming" | "active" | "completed";

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  created_at: string;
}

export type TournamentStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  season_id: string;
  category: string;
  start_date: string;
  end_date: string;
  venue: string;
  province: string;
  status: TournamentStatus;
  published: boolean;
  /** Configurable competition rules */
  periods: number;
  period_length_min: number;
  shot_clock_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  team_id: string;
  group_name: string | null;
  seed: number | null;
}

export interface PoolGroup {
  id: string;
  tournament_id: string;
  name: string;
  category: string;
  display_order: number;
}

export type MatchStatus =
  | "scheduled"
  | "live"
  | "paused"
  | "completed"
  | "abandoned"
  | "postponed";

/** Clock state persisted server-side; running_since timestamps make refresh recovery exact. */
export interface ClockState {
  /** Game clock: elapsed ms in current period. */
  elapsed_ms: number;
  /** ISO timestamp when the clock last started running; null when stopped. */
  running_since: string | null;
  period: number;
  /** Shot clock: elapsed ms in current possession. */
  shot_elapsed_ms: number;
  shot_running_since: string | null;
}

export type Verification = "unverified" | "verified" | "disputed";

export interface Match {
  id: string;
  tournament_id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  venue: string;
  round: string | null;
  pool_group_id: string | null;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  clock: ClockState;
  possession: "home" | "away" | null;
  started_at: string | null;
  ended_at: string | null;
  verification: Verification;
  periods: number;
  period_length_ms: number;
  shot_clock_ms: number;
  flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  school_id: string;
  name: string;
  position: string | null;
  active: boolean;
}

export interface RosterEntry {
  id: string;
  team_id: string;
  season_id: string;
  player_id: string;
  cap_number: number;
  is_goalkeeper: boolean;
}

export type EventCategory =
  | "scoring"
  | "shooting"
  | "fouls"
  | "possession"
  | "attack"
  | "control";

export interface MatchEvent {
  id: string;
  match_id: string;
  /** Authoritative sequence within the match, assigned by the server. */
  seq: number;
  period: number;
  /** Game clock at the moment of the event: ms REMAINING in the period. */
  game_clock_ms: number;
  team_id: string | null;
  player_id: string | null;
  player_cap: number | null;
  secondary_player_id: string | null;
  category: EventCategory;
  event_type: string;
  outcome: string | null;
  created_by: string;
  recorded_at: string;
  deleted_at: string | null;
  correction_reason: string | null;
}

export type Eligibility = "eligible" | "provisional" | "insufficient_data" | "under_review";

export interface RankingConfig {
  id: string;
  season_id: string;
  category: string;
  version: number;
  win_rate_weight: number;
  offensive_weight: number;
  defensive_weight: number;
  draw_value: number;
  min_games: number;
  status: "draft" | "published";
  effective_from: string;
  created_by: string;
  created_at: string;
}

export interface RankingRow {
  team_id: string;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  adjusted_win_rate: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  gf_per_game: number;
  ga_per_game: number;
  offensive_efficiency: number;
  defensive_efficiency: number;
  score: number;
  rank: number;
  eligibility: Eligibility;
}

export interface RankingSnapshot {
  id: string;
  season_id: string;
  category: string;
  config_id: string;
  config_version: number;
  calculated_at: string;
  published: boolean;
  rows: RankingRow[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  school_id: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string;
  created_at: string;
}

/** Denormalised view used by tables, dashboards and profiles. */
export interface MatchView extends Match {
  home_team: Team;
  home_school: School;
  away_team: Team;
  away_school: School;
  tournament_name: string;
}

export interface TeamView {
  team: Team;
  school: School;
}
