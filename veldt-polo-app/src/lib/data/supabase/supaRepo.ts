import { getSupabaseClient } from "./client";
import { RepoError, type AppRepo, type EventInput, type MatchFilter } from "@/lib/data/repo";
import type {
  AuditLog, ClockState, Match, MatchEvent, MatchStatus, MatchView, Player,
  RankingConfig, RankingSnapshot, RosterEntry, Role, School, Season, Team,
  TeamView, Tournament, TournamentEntry, UserProfile, Verification,
} from "@/lib/domain/types";

/**
 * Supabase repository. All access flows through the anon client so Row Level
 * Security is authoritative — the database, not the UI, decides what a role
 * may read or write. Row shapes mirror the SQL schema in backend/migrations.
 */

// The generated DB types live in src/integrations/supabase/types.ts once the
// backend is connected; until then queries are typed against the domain model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function mapSchool(r: Row): School {
  return {
    id: r.id, name: r.name, slug: r.slug, province: r.province, city: r.city,
    type: r.type, logo_url: r.logo_url, website_url: r.website_url,
    active: r.active, created_at: r.created_at, updated_at: r.updated_at,
  };
}

function mapMatch(r: Row): Match {
  return {
    id: r.id, tournament_id: r.tournament_id, season_id: r.season_id,
    home_team_id: r.home_team_id, away_team_id: r.away_team_id,
    scheduled_at: r.scheduled_at, venue: r.venue, round: r.round, pool_group_id: r.pool_group_id,
    status: r.status, home_score: r.home_score, away_score: r.away_score,
    clock: (r.clock ?? {}) as ClockState,
    possession: r.possession, started_at: r.started_at, ended_at: r.ended_at,
    verification: r.verification, periods: r.periods, period_length_ms: r.period_length_ms,
    shot_clock_ms: r.shot_clock_ms, flagged: r.flagged, created_at: r.created_at, updated_at: r.updated_at,
  };
}

export class SupabaseRepo implements AppRepo {
  mode = "supabase" as const;

  private sb() {
    const sb = getSupabaseClient();
    if (!sb) throw new RepoError("Supabase is not configured.");
    return sb;
  }

  private unwrap<T>(data: T | null, error: { message: string } | null, what: string): T {
    if (error) throw new RepoError(`${what}: ${error.message}`, error);
    return data as T;
  }

  // ---------- Schools ----------
  async listSchools(): Promise<School[]> {
    const { data, error } = await this.sb().from("schools").select("*").order("name");
    return this.unwrap(data, error, "Load schools").map(mapSchool);
  }
  async getSchool(slugOrId: string): Promise<School | null> {
    const sb = this.sb();
    const { data, error } = await sb.rpc("get_school_by_slug_or_id", { key: slugOrId });
    if (error) {
      const single = await sb.from("schools").select("*").or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
      return single.data ? mapSchool(single.data) : null;
    }
    return data?.[0] ? mapSchool(data[0]) : null;
  }
  async upsertSchool(input: Partial<School> & { name: string }): Promise<School> {
    const { data, error } = await this.sb().from("schools").upsert(input).select().single();
    return this.unwrap(data, error, "Save school");
  }
  async archiveSchool(id: string, active: boolean): Promise<void> {
    const { error } = await this.sb().from("schools").update({ active }).eq("id", id);
    this.unwrap(error === null ? {} : null, error, "Archive school");
  }

  // ---------- Teams ----------
  async listTeams(filter?: { schoolId?: string; category?: string }): Promise<TeamView[]> {
    let q = this.sb().from("teams").select("*, school:schools(*)").order("name");
    if (filter?.schoolId) q = q.eq("school_id", filter.schoolId);
    if (filter?.category) q = q.eq("category", filter.category);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load teams").map((r: Row): TeamView => ({ team: r as Team, school: r.school as School }));
  }
  async getTeam(id: string): Promise<TeamView | null> {
    const { data, error } = await this.sb().from("teams").select("*, school:schools(*)").eq("id", id).maybeSingle();
    const row = this.unwrap(data, error, "Load team");
    return row ? { team: row as Team, school: (row as Row).school as School } : null;
  }
  async upsertTeam(input: Partial<Team> & { school_id: string; name: string; category: string }): Promise<Team> {
    const { data, error } = await this.sb().from("teams").upsert(input).select().single();
    return this.unwrap(data, error, "Save team");
  }
  async archiveTeam(id: string, active: boolean): Promise<void> {
    const { error } = await this.sb().from("teams").update({ active }).eq("id", id);
    this.unwrap(error === null ? {} : null, error, "Archive team");
  }

  // ---------- Seasons ----------
  async listSeasons(): Promise<Season[]> {
    const { data, error } = await this.sb().from("seasons").select("*").order("start_date", { ascending: false });
    return this.unwrap(data, error, "Load seasons");
  }
  async upsertSeason(input: Partial<Season> & { name: string }): Promise<Season> {
    const { data, error } = await this.sb().from("seasons").upsert(input).select().single();
    return this.unwrap(data, error, "Save season");
  }

  // ---------- Tournaments ----------
  async listTournaments(filter?: { seasonId?: string; publishedOnly?: boolean }): Promise<(Tournament & { season_name: string; entry_count: number })[]> {
    let q = this.sb().from("tournaments_with_counts").select("*").order("start_date");
    if (filter?.seasonId) q = q.eq("season_id", filter.seasonId);
    if (filter?.publishedOnly) q = q.eq("published", true);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load tournaments");
  }
  async getTournament(slugOrId: string): Promise<(Tournament & { season_name: string }) | null> {
    const { data, error } = await this.sb().from("tournaments_with_counts").select("*").or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
    return this.unwrap(data, error, "Load tournament");
  }
  async upsertTournament(input: Partial<Tournament> & { name: string; season_id: string }): Promise<Tournament> {
    const { data, error } = await this.sb().from("tournaments").upsert(input).select().single();
    return this.unwrap(data, error, "Save tournament");
  }
  async setTournamentPublished(id: string, published: boolean): Promise<void> {
    const { error } = await this.sb().from("tournaments").update({ published, updated_at: new Date().toISOString() }).eq("id", id);
    this.unwrap(error === null ? {} : null, error, "Publish tournament");
  }
  async listEntries(tournamentId: string): Promise<(TournamentEntry & { team_name: string; school_name: string })[]> {
    const { data, error } = await this.sb().from("tournament_entries")
      .select("*, team:teams(name, school:schools(name))")
      .eq("tournament_id", tournamentId);
    return this.unwrap(data, error, "Load entries").map((r: Row) => ({
      id: r.id, tournament_id: r.tournament_id, team_id: r.team_id, group_name: r.group_name, seed: r.seed,
      team_name: r.team?.name ?? "?", school_name: r.team?.school?.name ?? "?",
    }));
  }
  async addEntry(tournamentId: string, teamId: string, groupName: string | null): Promise<void> {
    const { error } = await this.sb().from("tournament_entries").insert({ tournament_id: tournamentId, team_id: teamId, group_name: groupName });
    this.unwrap(error === null ? {} : null, error, "Add entry");
  }
  async removeEntry(entryId: string): Promise<void> {
    const { error } = await this.sb().from("tournament_entries").delete().eq("id", entryId);
    this.unwrap(error === null ? {} : null, error, "Remove entry");
  }

  // ---------- Matches ----------
  private matchQuery() {
    return this.sb().from("matches").select(`
      *, home_team:teams!matches_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!matches_away_team_id_fkey(*, school:schools(*)),
      tournament:tournaments(name)
    `);
  }
  private toView(r: Row): MatchView {
    return {
      ...mapMatch(r),
      home_team: r.home_team as Team,
      home_school: (r.home_team as Row)?.school as School,
      away_team: r.away_team as Team,
      away_school: (r.away_team as Row)?.school as School,
      tournament_name: r.tournament?.name ?? "",
    };
  }
  async listMatches(filter?: MatchFilter): Promise<MatchView[]> {
    let q = this.matchQuery();
    if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
    if (filter?.seasonId) q = q.eq("season_id", filter.seasonId);
    if (filter?.tournamentId) q = q.eq("tournament_id", filter.tournamentId);
    if (filter?.teamId) q = q.or(`home_team_id.eq.${filter.teamId},away_team_id.eq.${filter.teamId}`);
    q = q.order("scheduled_at", { ascending: false });
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load matches").map((r: Row) => this.toView(r));
  }
  async getMatch(id: string): Promise<MatchView | null> {
    const { data, error } = await this.matchQuery().eq("id", id).maybeSingle();
    const row = this.unwrap(data, error, "Load match");
    return row ? this.toView(row) : null;
  }
  async createMatch(input: Partial<Match> & { tournament_id: string; season_id: string; home_team_id: string; away_team_id: string; scheduled_at: string }): Promise<Match> {
    const { data, error } = await this.sb().from("matches").insert(input).select().single();
    return mapMatch(this.unwrap(data, error, "Create match"));
  }
  async updateMatch(id: string, input: Partial<Match>): Promise<Match> {
    const { data, error } = await this.sb().from("matches").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    return mapMatch(this.unwrap(data, error, "Update match"));
  }
  async persistClock(id: string, clock: ClockState, possession: Match["possession"], status: MatchStatus): Promise<Match> {
    const { data, error } = await this.sb().rpc("persist_match_clock", { p_match_id: id, p_clock: clock, p_possession: possession, p_status: status });
    return mapMatch(this.unwrap(data, error, "Save clock"));
  }
  async listEvents(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await this.sb().from("match_events").select("*").eq("match_id", matchId).order("seq");
    return this.unwrap(data, error, "Load events");
  }
  async recordEvent(input: EventInput, operatorId: string): Promise<{ event: MatchEvent; match: Match }> {
    const { data, error } = await this.sb().rpc("record_match_event", { p_event: input, p_operator: operatorId });
    const res = this.unwrap(data, error, "Record event") as { event: MatchEvent; match: Match };
    return res;
  }
  async undoEvent(eventId: string, reason: string, actorId: string): Promise<{ event: MatchEvent; match: Match }> {
    const { data, error } = await this.sb().rpc("undo_match_event", { p_event_id: eventId, p_reason: reason, p_actor: actorId });
    return this.unwrap(data, error, "Undo event") as { event: MatchEvent; match: Match };
  }
  async finaliseMatch(id: string, actor: { id: string; name: string }): Promise<Match> {
    const { data, error } = await this.sb().rpc("finalise_match", { p_match_id: id, p_actor: actor.id });
    return mapMatch(this.unwrap(data, error, "Finalise match"));
  }
  async setVerification(id: string, verification: Verification, reason: string, actor: { id: string; name: string }): Promise<Match> {
    const { data, error } = await this.sb().rpc("set_match_verification", { p_match_id: id, p_verification: verification, p_reason: reason, p_actor: actor.id });
    return mapMatch(this.unwrap(data, error, "Set verification"));
  }

  // ---------- Players & rosters ----------
  async listPlayers(schoolId?: string): Promise<Player[]> {
    let q = this.sb().from("players").select("*").order("name");
    if (schoolId) q = q.eq("school_id", schoolId);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load players");
  }
  async upsertPlayer(input: Partial<Player> & { school_id: string; name: string }): Promise<Player> {
    const { data, error } = await this.sb().from("players").upsert(input).select().single();
    return this.unwrap(data, error, "Save player");
  }
  async listRoster(teamId: string, seasonId: string): Promise<(RosterEntry & { player_name: string })[]> {
    const { data, error } = await this.sb().from("team_rosters").select("*, player:players(name)").eq("team_id", teamId).eq("season_id", seasonId);
    return this.unwrap(data, error, "Load roster").map((r: Row) => ({ ...(r as RosterEntry), player_name: r.player?.name ?? "?" })) as (RosterEntry & { player_name: string })[];
  }
  async setRoster(entry: Partial<RosterEntry> & { team_id: string; season_id: string; player_id: string; cap_number: number }): Promise<void> {
    const { error } = await this.sb().from("team_rosters").upsert(entry);
    this.unwrap(error === null ? {} : null, error, "Save roster entry");
  }
  async removeRoster(entryId: string): Promise<void> {
    const { error } = await this.sb().from("team_rosters").delete().eq("id", entryId);
    this.unwrap(error === null ? {} : null, error, "Remove roster entry");
  }

  // ---------- Rankings ----------
  async listRankingConfigs(seasonId?: string): Promise<RankingConfig[]> {
    let q = this.sb().from("ranking_configs").select("*").order("version", { ascending: false });
    if (seasonId) q = q.eq("season_id", seasonId);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load ranking configs");
  }
  async upsertRankingConfig(input: Partial<RankingConfig> & { season_id: string; category: string }): Promise<RankingConfig> {
    const { data, error } = await this.sb().from("ranking_configs").upsert(input).select().single();
    return this.unwrap(data, error, "Save ranking config");
  }
  async listRankingSnapshots(filter?: { publishedOnly?: boolean; seasonId?: string; category?: string }): Promise<RankingSnapshot[]> {
    let q = this.sb().from("ranking_snapshots").select("*, rows:ranking_snapshot_rows(*)").order("calculated_at", { ascending: false });
    if (filter?.publishedOnly) q = q.eq("published", true);
    if (filter?.seasonId) q = q.eq("season_id", filter.seasonId);
    if (filter?.category) q = q.eq("category", filter.category);
    const { data, error } = await q;
    return this.unwrap(data, error, "Load rankings").map((r: Row) => ({ ...r, rows: r.rows ?? [] })) as RankingSnapshot[];
  }
  async saveRankingSnapshot(snapshot: Omit<RankingSnapshot, "id" | "calculated_at"> & { id?: string }, _actor: { id: string; name: string }): Promise<RankingSnapshot> {
    const sb = this.sb();
    const { id, rows, ...meta } = snapshot;
    let snapshotId = id;
    if (!snapshotId) {
      const { data, error } = await sb.from("ranking_snapshots").insert(meta).select("id").single();
      snapshotId = this.unwrap(data, error, "Create snapshot").id as string;
    } else {
      const { error } = await sb.from("ranking_snapshots").update(meta).eq("id", snapshotId);
      this.unwrap(error === null ? {} : null, error, "Update snapshot");
    }
    if (rows?.length) {
      const payload = rows.map((r) => ({ ...r, snapshot_id: snapshotId }));
      const { error } = await sb.from("ranking_snapshot_rows").upsert(payload, { onConflict: "snapshot_id,team_id" });
      this.unwrap(error === null ? {} : null, error, "Save ranking rows");
    }
    const { data: full, error: fullErr } = await sb.from("ranking_snapshots").select("*, rows:ranking_snapshot_rows(*)").eq("id", snapshotId).single();
    return this.unwrap(full, fullErr, "Load snapshot");
  }

  // ---------- Users & roles ----------
  async listUsers(): Promise<UserProfile[]> {
    const { data, error } = await this.sb().from("user_profiles_with_roles").select("*").order("created_at");
    return this.unwrap(data, error, "Load users");
  }
  async setUserRoles(userId: string, roles: Role[], actor: { id: string; name: string }): Promise<void> {
    const { error } = await this.sb().rpc("set_user_roles", { p_user: userId, p_roles: roles, p_actor: actor.id, p_actor_name: actor.name });
    this.unwrap(error === null ? {} : null, error, "Set roles");
  }
  async inviteUser(input: { email: string; name: string; roles: Role[] }, actor: { id: string; name: string }): Promise<UserProfile> {
    const { data, error } = await this.sb().rpc("invite_user", { p_email: input.email, p_name: input.name, p_roles: input.roles, p_actor: actor.id, p_actor_name: actor.name });
    return this.unwrap(data, error, "Invite user");
  }

  // ---------- Audit ----------
  async listAuditLogs(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await this.sb().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    return this.unwrap(data, error, "Load audit logs");
  }
}
