import type {
  AuditLog,
  Match,
  MatchEvent,
  MatchView,
  MatchStatus,
  ClockState,
  Player,
  RankingConfig,
  RankingSnapshot,
  RosterEntry,
  Role,
  School,
  Season,
  Team,
  TeamView,
  Tournament,
  TournamentEntry,
  UserProfile,
  Verification,
} from "@/lib/domain/types";

/**
 * Application repository — the single data boundary for every screen.
 * Two implementations: demo (browser-persisted, clearly labelled) and Supabase.
 * Screens never talk to the database directly, so business rules stay testable
 * and the backend can be swapped without touching UI.
 */

export interface MatchFilter {
  status?: MatchStatus | "all";
  seasonId?: string;
  tournamentId?: string;
  teamId?: string;
  limit?: number;
}

export interface EventInput {
  id: string; // client-generated UUID — duplicate protection on retries
  match_id: string;
  period: number;
  game_clock_ms: number;
  team_id: string | null;
  player_id: string | null;
  player_cap: number | null;
  category: MatchEvent["category"];
  event_type: string;
}

export interface AppRepo {
  mode: "supabase" | "demo";

  // Schools
  listSchools(): Promise<School[]>;
  getSchool(slugOrId: string): Promise<School | null>;
  upsertSchool(input: Partial<School> & { name: string }): Promise<School>;
  archiveSchool(id: string, active: boolean): Promise<void>;

  // Teams
  listTeams(filter?: { schoolId?: string; category?: string }): Promise<TeamView[]>;
  getTeam(id: string): Promise<TeamView | null>;
  upsertTeam(input: Partial<Team> & { school_id: string; name: string; category: string }): Promise<Team>;
  archiveTeam(id: string, active: boolean): Promise<void>;

  // Seasons
  listSeasons(): Promise<Season[]>;
  upsertSeason(input: Partial<Season> & { name: string }): Promise<Season>;

  // Tournaments
  listTournaments(filter?: { seasonId?: string; publishedOnly?: boolean }): Promise<(Tournament & { season_name: string; entry_count: number })[]>;
  getTournament(slugOrId: string): Promise<(Tournament & { season_name: string }) | null>;
  upsertTournament(input: Partial<Tournament> & { name: string; season_id: string }): Promise<Tournament>;
  setTournamentPublished(id: string, published: boolean): Promise<void>;
  listEntries(tournamentId: string): Promise<(TournamentEntry & { team_name: string; school_name: string })[]>;
  addEntry(tournamentId: string, teamId: string, groupName: string | null): Promise<void>;
  removeEntry(entryId: string): Promise<void>;

  // Matches
  listMatches(filter?: MatchFilter): Promise<MatchView[]>;
  getMatch(id: string): Promise<MatchView | null>;
  createMatch(input: Partial<Match> & { tournament_id: string; season_id: string; home_team_id: string; away_team_id: string; scheduled_at: string }): Promise<Match>;
  updateMatch(id: string, input: Partial<Match>): Promise<Match>;
  persistClock(id: string, clock: ClockState, possession: Match["possession"], status: Match["status"]): Promise<Match>;
  listEvents(matchId: string): Promise<MatchEvent[]>;
  recordEvent(input: EventInput, operatorId: string): Promise<{ event: MatchEvent; match: Match }>;
  undoEvent(eventId: string, reason: string, actorId: string, actorName: string): Promise<{ event: MatchEvent; match: Match }>;
  finaliseMatch(id: string, actor: { id: string; name: string }): Promise<Match>;
  setVerification(id: string, verification: Verification, reason: string, actor: { id: string; name: string }): Promise<Match>;

  // Players & rosters
  listPlayers(schoolId?: string): Promise<Player[]>;
  upsertPlayer(input: Partial<Player> & { school_id: string; name: string }): Promise<Player>;
  listRoster(teamId: string, seasonId: string): Promise<(RosterEntry & { player_name: string })[]>;
  setRoster(entry: Partial<RosterEntry> & { team_id: string; season_id: string; player_id: string; cap_number: number }): Promise<void>;
  removeRoster(entryId: string): Promise<void>;

  // Rankings
  listRankingConfigs(seasonId?: string): Promise<RankingConfig[]>;
  upsertRankingConfig(input: Partial<RankingConfig> & { season_id: string; category: string }): Promise<RankingConfig>;
  listRankingSnapshots(filter?: { publishedOnly?: boolean; seasonId?: string; category?: string }): Promise<RankingSnapshot[]>;
  saveRankingSnapshot(snapshot: Omit<RankingSnapshot, "id" | "calculated_at"> & { id?: string }, actor: { id: string; name: string }): Promise<RankingSnapshot>;

  // Users & roles
  listUsers(): Promise<UserProfile[]>;
  setUserRoles(userId: string, roles: Role[], actor: { id: string; name: string }): Promise<void>;
  inviteUser(input: { email: string; name: string; roles: Role[] }, actor: { id: string; name: string }): Promise<UserProfile>;

  // Audit
  listAuditLogs(limit?: number): Promise<AuditLog[]>;
}

export class RepoError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "RepoError";
  }
}
