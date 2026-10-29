import type {
  AppRepo,
  EventInput,
  MatchFilter,
} from "@/lib/data/repo";
import { RepoError } from "@/lib/data/repo";
import type {
  AuditLog,
  ClockState,
  Match,
  MatchEvent,
  MatchStatus,
  MatchView,
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
} from "@/lib/domain/types";
import { eventDef } from "@/lib/domain/events";
import { buildDemoDb, type DemoDb } from "./seed";

const STORAGE_KEY = "swpza.demo.db.v1";

/**
 * Demo repository — browser-persisted implementation of the AppRepo boundary.
 * Every screen shows a clear banner that this is demonstration data; nothing
 * here touches a real backend. Swap to the Supabase repo by configuring
 * credentials (see src/lib/data/index.ts).
 */

let db: DemoDb | null = null;

function loadDb(): DemoDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = JSON.parse(raw) as DemoDb;
      return db;
    }
  } catch {
    // fall through to reseed
  }
  db = buildDemoDb();
  saveDb();
  return db;
}

function saveDb(): void {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable — demo data stays in memory for this session
  }
}

const delay = (ms = 60) => new Promise<void>((r) => setTimeout(r, ms));
const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export { DEMO_PASSWORD } from "./seed";

export function resetDemoDb(): void {
  db = buildDemoDb();
  saveDb();
}

export class DemoRepo implements AppRepo {
  mode = "demo" as const;

  private d(): DemoDb {
    return loadDb();
  }

  private async audit(entry: Omit<AuditLog, "id" | "created_at">): Promise<void> {
    this.d().audit_logs.unshift({ ...entry, id: uid(), created_at: new Date().toISOString() });
    saveDb();
  }

  // ---------- Schools ----------
  async listSchools(): Promise<School[]> {
    await delay();
    return [...this.d().schools].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSchool(slugOrId: string): Promise<School | null> {
    await delay();
    const d = this.d();
    return d.schools.find((s) => s.slug === slugOrId || s.id === slugOrId) ?? null;
  }

  async upsertSchool(input: Partial<School> & { name: string }): Promise<School> {
    await delay();
    const d = this.d();
    const now = new Date().toISOString();
    if (input.id) {
      const existing = d.schools.find((s) => s.id === input.id);
      if (!existing) throw new RepoError("School not found");
      Object.assign(existing, input, { updated_at: now });
      saveDb();
      await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "school.update", entity: "school", entity_id: existing.id, detail: `Updated ${existing.name}` });
      return existing;
    }
    const school: School = {
      id: `sch-${uid()}`,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      province: input.province ?? "",
      city: input.city ?? "",
      type: input.type ?? null,
      logo_url: input.logo_url ?? null,
      website_url: input.website_url ?? null,
      active: input.active ?? true,
      created_at: now,
      updated_at: now,
      name: input.name,
    };
    d.schools.push(school);
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "school.create", entity: "school", entity_id: school.id, detail: `Created ${school.name}` });
    return school;
  }

  async archiveSchool(id: string, active: boolean): Promise<void> {
    await delay();
    const d = this.d();
    const s = d.schools.find((x) => x.id === id);
    if (!s) throw new RepoError("School not found");
    s.active = active;
    s.updated_at = new Date().toISOString();
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: active ? "school.activate" : "school.archive", entity: "school", entity_id: id, detail: `${active ? "Activated" : "Archived"} ${s.name}` });
  }

  // ---------- Teams ----------
  async listTeams(filter?: { schoolId?: string; category?: string }): Promise<TeamView[]> {
    await delay();
    const d = this.d();
    return d.teams
      .filter((t) => (!filter?.schoolId || t.school_id === filter.schoolId) && (!filter?.category || t.category === filter.category))
      .map((t) => ({
        team: t,
        school: d.schools.find((s) => s.id === t.school_id)!,
      }))
      .filter((v) => v.school)
      .sort((a, b) => a.school.name.localeCompare(b.school.name));
  }

  async getTeam(id: string): Promise<TeamView | null> {
    await delay();
    const d = this.d();
    const team = d.teams.find((t) => t.id === id);
    if (!team) return null;
    const school = d.schools.find((s) => s.id === team.school_id);
    return school ? { team, school } : null;
  }

  async upsertTeam(input: Partial<Team> & { school_id: string; name: string; category: string }): Promise<Team> {
    await delay();
    const d = this.d();
    const now = new Date().toISOString();
    if (input.id) {
      const existing = d.teams.find((t) => t.id === input.id);
      if (!existing) throw new RepoError("Team not found");
      Object.assign(existing, input, { updated_at: now });
      saveDb();
      await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "team.update", entity: "team", entity_id: existing.id, detail: `Updated ${existing.name}` });
      return existing;
    }
    const gender = input.gender ?? (input.category.includes("girls") ? "girls" : "boys");
    const team: Team = {
      id: `team-${uid()}`,
      school_id: input.school_id,
      name: input.name,
      category: input.category,
      age_group: input.age_group ?? "U19",
      gender,
      active: input.active ?? true,
      created_at: now,
      updated_at: now,
    };
    d.teams.push(team);
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "team.create", entity: "team", entity_id: team.id, detail: `Created ${team.name}` });
    return team;
  }

  async archiveTeam(id: string, active: boolean): Promise<void> {
    await delay();
    const d = this.d();
    const t = d.teams.find((x) => x.id === id);
    if (!t) throw new RepoError("Team not found");
    t.active = active;
    t.updated_at = new Date().toISOString();
    saveDb();
  }

  // ---------- Seasons ----------
  async listSeasons(): Promise<Season[]> {
    await delay();
    return [...this.d().seasons].sort((a, b) => b.name.localeCompare(a.name));
  }

  async upsertSeason(input: Partial<Season> & { name: string }): Promise<Season> {
    await delay();
    const d = this.d();
    if (input.id) {
      const existing = d.seasons.find((s) => s.id === input.id);
      if (!existing) throw new RepoError("Season not found");
      Object.assign(existing, input);
      saveDb();
      return existing;
    }
    const season: Season = {
      id: `season-${uid()}`,
      name: input.name,
      start_date: input.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: input.end_date ?? new Date().toISOString().slice(0, 10),
      status: input.status ?? "active",
      created_at: new Date().toISOString(),
    };
    d.seasons.push(season);
    saveDb();
    return season;
  }

  // ---------- Tournaments ----------
  async listTournaments(filter?: { seasonId?: string; publishedOnly?: boolean }): Promise<(Tournament & { season_name: string; entry_count: number })[]> {
    await delay();
    const d = this.d();
    return d.tournaments
      .filter((t) => (!filter?.seasonId || t.season_id === filter.seasonId) && (!filter?.publishedOnly || t.published))
      .map((t) => ({
        ...t,
        season_name: d.seasons.find((s) => s.id === t.season_id)?.name ?? "",
        entry_count: d.entries.filter((e) => e.tournament_id === t.id).length,
      }))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  async getTournament(slugOrId: string): Promise<(Tournament & { season_name: string }) | null> {
    await delay();
    const d = this.d();
    const t = d.tournaments.find((x) => x.slug === slugOrId || x.id === slugOrId);
    if (!t) return null;
    return { ...t, season_name: d.seasons.find((s) => s.id === t.season_id)?.name ?? "" };
  }

  async upsertTournament(input: Partial<Tournament> & { name: string; season_id: string }): Promise<Tournament> {
    await delay();
    const d = this.d();
    const now = new Date().toISOString();
    if (input.id) {
      const existing = d.tournaments.find((t) => t.id === input.id);
      if (!existing) throw new RepoError("Tournament not found");
      Object.assign(existing, input, { updated_at: now });
      saveDb();
      await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "tournament.update", entity: "tournament", entity_id: existing.id, detail: `Updated ${existing.name}` });
      return existing;
    }
    const t: Tournament = {
      id: `t-${uid()}`,
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      season_id: input.season_id,
      category: input.category ?? "first_team_boys",
      start_date: input.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: input.end_date ?? new Date().toISOString().slice(0, 10),
      venue: input.venue ?? "",
      province: input.province ?? "",
      status: input.status ?? "scheduled",
      published: input.published ?? false,
      periods: input.periods ?? 4,
      period_length_min: input.period_length_min ?? 7,
      shot_clock_seconds: input.shot_clock_seconds ?? 20,
      created_at: now,
      updated_at: now,
    };
    d.tournaments.push(t);
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "tournament.create", entity: "tournament", entity_id: t.id, detail: `Created ${t.name}` });
    return t;
  }

  async setTournamentPublished(id: string, published: boolean): Promise<void> {
    await delay();
    const d = this.d();
    const t = d.tournaments.find((x) => x.id === id);
    if (!t) throw new RepoError("Tournament not found");
    t.published = published;
    t.updated_at = new Date().toISOString();
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: published ? "tournament.publish" : "tournament.unpublish", entity: "tournament", entity_id: id, detail: `${published ? "Published" : "Unpublished"} ${t.name}` });
  }

  async listEntries(tournamentId: string): Promise<(TournamentEntry & { team_name: string; school_name: string })[]> {
    await delay();
    const d = this.d();
    return d.entries
      .filter((e) => e.tournament_id === tournamentId)
      .map((e) => {
        const team = d.teams.find((t) => t.id === e.team_id);
        const school = team ? d.schools.find((s) => s.id === team.school_id) : undefined;
        return { ...e, team_name: team?.name ?? "?", school_name: school?.name ?? "?" };
      })
      .sort((a, b) => a.school_name.localeCompare(b.school_name));
  }

  async addEntry(tournamentId: string, teamId: string, groupName: string | null): Promise<void> {
    await delay();
    const d = this.d();
    const dup = d.entries.find((e) => e.tournament_id === tournamentId && e.team_id === teamId);
    if (dup) throw new RepoError("This team is already entered in the tournament.");
    d.entries.push({ id: `entry-${uid()}`, tournament_id: tournamentId, team_id: teamId, group_name: groupName, seed: null });
    saveDb();
  }

  async removeEntry(entryId: string): Promise<void> {
    await delay();
    const d = this.d();
    d.entries = d.entries.filter((e) => e.id !== entryId);
    saveDb();
  }

  // ---------- Matches ----------
  private matchViews(list: Match[]): MatchView[] {
    const d = this.d();
    return list
      .map((m) => {
        const home = d.teams.find((t) => t.id === m.home_team_id);
        const away = d.teams.find((t) => t.id === m.away_team_id);
        const homeSchool = home ? d.schools.find((s) => s.id === home.school_id) : undefined;
        const awaySchool = away ? d.schools.find((s) => s.id === away.school_id) : undefined;
        const tournament = d.tournaments.find((t) => t.id === m.tournament_id);
        if (!home || !away || !homeSchool || !awaySchool || !tournament) return null;
        return { ...m, home_team: home, home_school: homeSchool, away_team: away, away_school: awaySchool, tournament_name: tournament.name };
      })
      .filter((x): x is MatchView => x !== null);
  }

  async listMatches(filter?: MatchFilter): Promise<MatchView[]> {
    await delay(80);
    const d = this.d();
    let list = [...d.matches];
    if (filter?.status && filter.status !== "all") list = list.filter((m) => m.status === filter.status);
    if (filter?.seasonId) list = list.filter((m) => m.season_id === filter.seasonId);
    if (filter?.tournamentId) list = list.filter((m) => m.tournament_id === filter.tournamentId);
    if (filter?.teamId) list = list.filter((m) => m.home_team_id === filter.teamId || m.away_team_id === filter.teamId);
    list.sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
    const views = this.matchViews(list);
    return filter?.limit ? views.slice(0, filter.limit) : views;
  }

  async getMatch(id: string): Promise<MatchView | null> {
    await delay();
    return this.matchViews(this.d().matches.filter((m) => m.id === id))[0] ?? null;
  }

  async createMatch(input: Partial<Match> & { tournament_id: string; season_id: string; home_team_id: string; away_team_id: string; scheduled_at: string }): Promise<Match> {
    await delay();
    const d = this.d();
    if (input.home_team_id === input.away_team_id) throw new RepoError("A team cannot play itself.");
    const dup = d.matches.find(
      (m) =>
        m.tournament_id === input.tournament_id &&
        m.status !== "abandoned" &&
        ((m.home_team_id === input.home_team_id && m.away_team_id === input.away_team_id) ||
          (m.home_team_id === input.away_team_id && m.away_team_id === input.home_team_id)),
    );
    if (dup) throw new RepoError("These two teams already have a fixture in this tournament.");
    const tournament = d.tournaments.find((t) => t.id === input.tournament_id);
    const match: Match = {
      id: `m-${uid()}`,
      tournament_id: input.tournament_id,
      season_id: input.season_id,
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      scheduled_at: input.scheduled_at,
      venue: input.venue ?? "",
      round: input.round ?? null,
      pool_group_id: input.pool_group_id ?? null,
      status: "scheduled",
      home_score: 0,
      away_score: 0,
      clock: { elapsed_ms: 0, running_since: null, period: 1, shot_elapsed_ms: 0, shot_running_since: null },
      possession: null,
      started_at: null,
      ended_at: null,
      verification: "unverified",
      periods: tournament?.periods ?? 4,
      period_length_ms: (tournament?.period_length_min ?? 7) * 60 * 1000,
      shot_clock_ms: (tournament?.shot_clock_seconds ?? 20) * 1000,
      flagged: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    d.matches.push(match);
    saveDb();
    await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "match.create", entity: "match", entity_id: match.id, detail: `Scheduled fixture` });
    return match;
  }

  async updateMatch(id: string, input: Partial<Match>): Promise<Match> {
    await delay();
    const d = this.d();
    const m = d.matches.find((x) => x.id === id);
    if (!m) throw new RepoError("Match not found");
    Object.assign(m, input, { updated_at: new Date().toISOString() });
    saveDb();
    return m;
  }

  async persistClock(id: string, clock: ClockState, possession: Match["possession"], status: MatchStatus): Promise<Match> {
    const d = this.d();
    const m = d.matches.find((x) => x.id === id);
    if (!m) throw new RepoError("Match not found");
    m.clock = clock;
    m.possession = possession;
    m.status = status;
    m.updated_at = new Date().toISOString();
    if (!m.started_at && status === "live") m.started_at = new Date().toISOString();
    saveDb();
    return { ...m };
  }

  async listEvents(matchId: string): Promise<MatchEvent[]> {
    await delay();
    return this.d().events.filter((e) => e.match_id === matchId).sort((a, b) => a.seq - b.seq);
  }

  async recordEvent(input: EventInput, operatorId: string): Promise<{ event: MatchEvent; match: Match }> {
    const d = this.d();
    const m = d.matches.find((x) => x.id === input.match_id);
    if (!m) throw new RepoError("Match not found");
    if (m.status === "completed" || m.status === "abandoned") {
      throw new RepoError("This match is no longer open for scoring.");
    }
    const dup = d.events.find((e) => e.id === input.id);
    if (dup) {
      // Retry after a timeout: the event was already saved — return authoritative state, no duplicate row.
      return { event: dup, match: { ...m } };
    }
    const def = eventDef(input.event_type);
    const seq = d.events.filter((e) => e.match_id === m.id).length + 1;
    const event: MatchEvent = {
      id: input.id,
      match_id: m.id,
      seq,
      period: input.period,
      game_clock_ms: input.game_clock_ms,
      team_id: def.defensive ? null : input.team_id, // defensive events attributed below
      player_id: input.player_id,
      player_cap: input.player_cap,
      secondary_player_id: null,
      category: def.category,
      event_type: input.event_type,
      outcome: null,
      created_by: operatorId,
      recorded_at: new Date().toISOString(),
      deleted_at: null,
      correction_reason: null,
    };
    // Defensive events (block, GK save) are recorded for the team NOT in possession of the event
    if (def.defensive) {
      event.team_id = input.team_id;
    }
    d.events.push(event);

    if (def.scores && event.team_id) {
      if (event.team_id === m.home_team_id) m.home_score += 1;
      else if (event.team_id === m.away_team_id) m.away_score += 1;
      else throw new RepoError("Event team is not part of this match.");
    }
    m.updated_at = new Date().toISOString();
    saveDb();
    return { event, match: { ...m } };
  }

  async undoEvent(eventId: string, reason: string, actorId: string, actorName: string): Promise<{ event: MatchEvent; match: Match }> {
    const d = this.d();
    const event = d.events.find((e) => e.id === eventId);
    if (!event) throw new RepoError("Event not found");
    if (event.deleted_at) throw new RepoError("Event has already been undone.");
    const m = d.matches.find((x) => x.id === event.match_id)!;
    const def = eventDef(event.event_type);
    const now = new Date().toISOString();
    event.deleted_at = now;
    event.correction_reason = reason || "Operator undo";
    // Reverse score consequences so history and scoreboard stay consistent.
    if (def.scores && event.team_id) {
      if (event.team_id === m.home_team_id) m.home_score = Math.max(0, m.home_score - 1);
      else if (event.team_id === m.away_team_id) m.away_score = Math.max(0, m.away_score - 1);
    }
    m.updated_at = now;
    saveDb();
    await this.audit({ actor_id: actorId, actor_name: actorName, action: "event.undo", entity: "match_event", entity_id: event.id, detail: `Undid ${def.label} — ${reason}` });
    return { event, match: { ...m } };
  }

  async finaliseMatch(id: string, actor: { id: string; name: string }): Promise<Match> {
    await delay();
    const d = this.d();
    const m = d.matches.find((x) => x.id === id);
    if (!m) throw new RepoError("Match not found");
    // Reconcile the confirmed score with the event history where events exist.
    const goalEvents = d.events.filter((e) => e.match_id === id && !e.deleted_at && (e.event_type === "goal" || e.event_type === "penalty_goal"));
    if (goalEvents.length > 0) {
      const homeGoals = goalEvents.filter((e) => e.team_id === m.home_team_id).length;
      const awayGoals = goalEvents.filter((e) => e.team_id === m.away_team_id).length;
      if (homeGoals !== m.home_score || awayGoals !== m.away_score) {
        throw new RepoError(
          `Score does not reconcile with the event history (events say ${homeGoals}–${awayGoals}, scoreboard says ${m.home_score}–${m.away_score}). Correct the events or the score before finalising.`,
        );
      }
    }
    m.status = "completed";
    m.clock = { ...m.clock, running_since: null, shot_running_since: null };
    m.ended_at = new Date().toISOString();
    m.updated_at = new Date().toISOString();
    saveDb();
    await this.audit({ actor_id: actor.id, actor_name: actor.name, action: "match.finalise", entity: "match", entity_id: m.id, detail: `Final result ${m.home_score}–${m.away_score}` });
    return { ...m };
  }

  async setVerification(id: string, verification: Match["verification"], reason: string, actor: { id: string; name: string }): Promise<Match> {
    await delay();
    const d = this.d();
    const m = d.matches.find((x) => x.id === id);
    if (!m) throw new RepoError("Match not found");
    m.verification = verification;
    m.flagged = verification === "disputed";
    m.updated_at = new Date().toISOString();
    saveDb();
    await this.audit({ actor_id: actor.id, actor_name: actor.name, action: "match.verify", entity: "match", entity_id: id, detail: `Verification set to ${verification} — ${reason}` });
    return { ...m };
  }

  // ---------- Players & rosters ----------
  async listPlayers(schoolId?: string): Promise<Player[]> {
    await delay();
    return this.d().players.filter((p) => !schoolId || p.school_id === schoolId);
  }

  async upsertPlayer(input: Partial<Player> & { school_id: string; name: string }): Promise<Player> {
    await delay();
    const d = this.d();
    if (input.id) {
      const existing = d.players.find((p) => p.id === input.id);
      if (!existing) throw new RepoError("Player not found");
      Object.assign(existing, input);
      saveDb();
      return existing;
    }
    const p: Player = { id: `pl-${uid()}`, school_id: input.school_id, name: input.name, position: input.position ?? null, active: true };
    d.players.push(p);
    saveDb();
    return p;
  }

  async listRoster(teamId: string, seasonId: string): Promise<(RosterEntry & { player_name: string })[]> {
    await delay();
    const d = this.d();
    return d.rosters
      .filter((r) => r.team_id === teamId && r.season_id === seasonId)
      .map((r) => ({ ...r, player_name: d.players.find((p) => p.id === r.player_id)?.name ?? "?" }))
      .sort((a, b) => a.cap_number - b.cap_number);
  }

  async setRoster(entry: Partial<RosterEntry> & { team_id: string; season_id: string; player_id: string; cap_number: number }): Promise<void> {
    await delay();
    const d = this.d();
    const dup = d.rosters.find((r) => r.team_id === entry.team_id && r.season_id === entry.season_id && r.cap_number === entry.cap_number && r.player_id !== entry.player_id);
    if (dup) throw new RepoError(`Cap number ${entry.cap_number} is already taken for this team and season.`);
    d.rosters.push({
      id: `ros-${uid()}`,
      team_id: entry.team_id,
      season_id: entry.season_id,
      player_id: entry.player_id,
      cap_number: entry.cap_number,
      is_goalkeeper: entry.is_goalkeeper ?? false,
    });
    saveDb();
  }

  async removeRoster(entryId: string): Promise<void> {
    await delay();
    const d = this.d();
    d.rosters = d.rosters.filter((r) => r.id !== entryId);
    saveDb();
  }

  // ---------- Rankings ----------
  async listRankingConfigs(seasonId?: string): Promise<RankingConfig[]> {
    await delay();
    return this.d().ranking_configs.filter((c) => !seasonId || c.season_id === seasonId);
  }

  async upsertRankingConfig(input: Partial<RankingConfig> & { season_id: string; category: string }): Promise<RankingConfig> {
    await delay();
    const d = this.d();
    const now = new Date().toISOString();
    if (input.id) {
      const existing = d.ranking_configs.find((c) => c.id === input.id);
      if (!existing) throw new RepoError("Ranking configuration not found");
      Object.assign(existing, input);
      saveDb();
      await this.audit({ actor_id: "demo", actor_name: "Demo operator", action: "ranking.config.update", entity: "ranking_config", entity_id: existing.id, detail: `Updated ranking config v${existing.version}` });
      return existing;
    }
    const c: RankingConfig = {
      id: `rc-${uid()}`,
      season_id: input.season_id,
      category: input.category,
      version: 1,
      win_rate_weight: input.win_rate_weight ?? 0.6,
      offensive_weight: input.offensive_weight ?? 0.2,
      defensive_weight: input.defensive_weight ?? 0.2,
      draw_value: input.draw_value ?? 0.5,
      min_games: input.min_games ?? 6,
      status: input.status ?? "draft",
      effective_from: input.effective_from ?? now,
      created_by: input.created_by ?? "demo",
      created_at: now,
    };
    d.ranking_configs.push(c);
    saveDb();
    return c;
  }

  async listRankingSnapshots(filter?: { publishedOnly?: boolean; seasonId?: string; category?: string }): Promise<RankingSnapshot[]> {
    await delay();
    const d = this.d();
    return d.ranking_snapshots.filter(
      (s) =>
        (!filter?.publishedOnly || s.published) &&
        (!filter?.seasonId || s.season_id === filter.seasonId) &&
        (!filter?.category || s.category === filter.category),
    );
  }

  async saveRankingSnapshot(snapshot: Omit<RankingSnapshot, "id" | "calculated_at"> & { id?: string }, actor: { id: string; name: string }): Promise<RankingSnapshot> {
    await delay();
    const d = this.d();
    if (snapshot.id) {
      const existing = d.ranking_snapshots.find((s) => s.id === snapshot.id);
      if (!existing) throw new RepoError("Snapshot not found");
      Object.assign(existing, snapshot);
      saveDb();
      await this.audit({ actor_id: actor.id, actor_name: actor.name, action: "ranking.publish", entity: "ranking_snapshot", entity_id: existing.id, detail: `Published ${snapshot.category} ranking (v${snapshot.config_version})` });
      return existing;
    }
    const s: RankingSnapshot = {
      ...snapshot,
      id: `rs-${uid()}`,
      calculated_at: new Date().toISOString(),
    };
    d.ranking_snapshots.push(s);
    saveDb();
    await this.audit({ actor_id: actor.id, actor_name: actor.name, action: snapshot.published ? "ranking.publish" : "ranking.preview", entity: "ranking_snapshot", entity_id: s.id, detail: `${snapshot.published ? "Published" : "Previewed"} ${snapshot.category} ranking (v${snapshot.config_version})` });
    return s;
  }

  // ---------- Users & roles ----------
  async listUsers(): Promise<UserProfile[]> {
    await delay();
    return [...this.d().users];
  }

  async setUserRoles(userId: string, roles: Role[], actor: { id: string; name: string }): Promise<void> {
    await delay();
    const d = this.d();
    const u = d.users.find((x) => x.id === userId);
    if (!u) throw new RepoError("User not found");
    u.roles = roles;
    saveDb();
    await this.audit({ actor_id: actor.id, actor_name: actor.name, action: "user.roles", entity: "user_profile", entity_id: userId, detail: `Roles set to ${roles.join(", ") || "none"} for ${u.name}` });
  }

  async inviteUser(input: { email: string; name: string; roles: Role[] }, actor: { id: string; name: string }): Promise<UserProfile> {
    await delay();
    const d = this.d();
    const dup = d.users.find((u) => u.email.toLowerCase() === input.email.toLowerCase());
    if (dup) throw new RepoError("A user with this email already exists.");
    const u: UserProfile = {
      id: `u-${uid()}`,
      email: input.email,
      name: input.name,
      roles: input.roles,
      school_id: null,
      created_at: new Date().toISOString(),
    };
    d.users.push(u);
    d.passwords[input.email] = "demo1234";
    saveDb();
    await this.audit({ actor_id: actor.id, actor_name: actor.name, action: "user.invite", entity: "user_profile", entity_id: u.id, detail: `Invited ${u.name} (${u.email}) as ${u.roles.join(", ") || "no role"}` });
    return u;
  }

  // ---------- Audit ----------
  async listAuditLogs(limit = 100): Promise<AuditLog[]> {
    await delay();
    return this.d().audit_logs.slice(0, limit);
  }
}

// Demo credential check used by the demo auth provider.
export function checkDemoCredentials(email: string, password: string): UserProfile | null {
  const d = loadDb();
  const u = d.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || d.passwords[u.email] !== password) return null;
  return u;
}

/** Demo sign-in accounts shown on the login page (never passwords directly). */
export function listDemoUsers(): UserProfile[] {
  return loadDb().users;
}
