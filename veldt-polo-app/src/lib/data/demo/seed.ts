import type {
  AuditLog,
  Match,
  MatchEvent,
  Player,
  RankingConfig,
  RankingSnapshot,
  RosterEntry,
  School,
  Season,
  Team,
  Tournament,
  TournamentEntry,
  UserProfile,
} from "@/lib/domain/types";
import { computeRankings } from "@/lib/domain/rankings";

/**
 * Demonstration dataset — 2021 proof-of-concept season, clearly labelled in the UI.
 * Deterministically generated so every load shows the same competition.
 * This dataset does NOT represent complete national coverage.
 */

export interface DemoDb {
  schools: School[];
  teams: Team[];
  seasons: Season[];
  tournaments: Tournament[];
  entries: TournamentEntry[];
  matches: Match[];
  events: MatchEvent[];
  players: Player[];
  rosters: RosterEntry[];
  ranking_configs: RankingConfig[];
  ranking_snapshots: RankingSnapshot[];
  users: UserProfile[];
  passwords: Record<string, string>;
  audit_logs: AuditLog[];
}

export const DEMO_PASSWORD = "demo1234";

// Deterministic PRNG (mulberry32) so the dataset is stable.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date): string => d.toISOString();
const day = (base: string, days: number, hour = 10, min = 0): string => {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, min, 0, 0);
  return iso(d);
};

export function buildDemoDb(): DemoDb {
  const rand = rng(20210601);
  const now = new Date().toISOString();

  const schoolDefs: [name: string, city: string, province: string, type: string][] = [
    ["Selborne College", "East London", "Eastern Cape", "Boys"],
    ["St Stithians College", "Johannesburg", "Gauteng", "Co-educational"],
    ["Clifton College", "Durban", "KwaZulu-Natal", "Boys"],
    ["Reddam House Durbanville", "Cape Town", "Western Cape", "Co-educational"],
    ["Bishops Diocesan College", "Cape Town", "Western Cape", "Boys"],
    ["South African College Schools (SACS)", "Cape Town", "Western Cape", "Boys"],
    ["Hilton College", "Pietermaritzburg", "KwaZulu-Natal", "Boys"],
    ["Westville Boys' High School", "Durban", "KwaZulu-Natal", "Boys"],
    ["Michaelhouse", "Balgowan", "KwaZulu-Natal", "Boys"],
    ["Pretoria Boys High School", "Pretoria", "Gauteng", "Boys"],
    ["Grey College", "Port Elizabeth", "Eastern Cape", "Boys"],
    ["Durban High School", "Durban", "KwaZulu-Natal", "Boys"],
    ["Kingswood College", "Makhanda", "Eastern Cape", "Co-educational"],
    ["Roedean School", "Johannesburg", "Gauteng", "Girls"],
    ["Herschel Girls School", "Cape Town", "Western Cape", "Girls"],
    ["St Mary's DSG", "Pretoria", "Gauteng", "Girls"],
    ["The Wykeham Collegiate", "Pietermaritzburg", "KwaZulu-Natal", "Girls"],
    ["Rustenburg Girls' High School", "Cape Town", "Western Cape", "Girls"],
  ];

  const schools: School[] = schoolDefs.map(([name, city, province, type], i) => ({
    id: `sch-${i + 1}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    province,
    city,
    type,
    logo_url: null,
    website_url: null,
    active: true,
    created_at: now,
    updated_at: now,
  }));
  const schoolByName = (n: string) => schools.find((s) => s.name.startsWith(n))!;

  const teams: Team[] = [];
  const mkTeam = (school: School, category: "first_team_boys" | "first_team_girls"): Team => {
    const t: Team = {
      id: `team-${school.slug}-${category === "first_team_boys" ? "b" : "g"}`,
      school_id: school.id,
      name: `${school.name} ${category === "first_team_boys" ? "1st Boys" : "1st Girls"}`,
      category,
      age_group: "U19",
      gender: category === "first_team_boys" ? "boys" : "girls",
      active: true,
      created_at: now,
      updated_at: now,
    };
    teams.push(t);
    return t;
  };

  const boysSchools = schools.filter((s) => s.type === "Boys" || s.name.startsWith("St Stithians") || s.name.startsWith("Reddam"));
  const boysTeams = boysSchools.map((s) => mkTeam(s, "first_team_boys"));
  const girlsSchools = schools.filter((s) => s.type === "Girls" || s.type === "Co-educational");
  const girlsTeams = girlsSchools.map((s) => mkTeam(s, "first_team_girls"));

  const seasons: Season[] = [
    { id: "season-2021", name: "2021 Season", start_date: "2021-06-01", end_date: "2021-09-30", status: "completed", created_at: now },
  ];

  const entries: TournamentEntry[] = [];
  const mkTournament = (
    id: string, name: string, province: string, venue: string, start: string, end: string,
    category: string, teamIds: string[],
  ): Tournament => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const t: Tournament = {
      id, name, slug, season_id: "season-2021", category, start_date: start, end_date: end,
      venue, province, status: "completed", published: true,
      periods: 4, period_length_min: 7, shot_clock_seconds: 20,
      created_at: now, updated_at: now,
    };
    entries.push(...teamIds.map((teamId, i) => ({ id: `${id}-entry-${i}`, tournament_id: id, team_id: teamId, group_name: "Pool A", seed: i + 1 })));
    return t;
  };

  const boysIds = boysTeams.map((t) => t.id);
  const girlsIds = girlsTeams.map((t) => t.id);

  const tournaments: Tournament[] = [
    mkTournament("t-ct-premier", "Cape Town Premier Tournament", "Western Cape", "SACS Pool, Cape Town", "2021-06-12", "2021-06-27", "first_team_boys", boysIds.slice(0, 8)),
    mkTournament("t-kzn-inv", "KZN Invitational", "KwaZulu-Natal", "UKZN Pool, Durban", "2021-07-03", "2021-07-25", "first_team_boys", boysIds.slice(2, 10)),
    mkTournament("t-gauteng-league", "Gauteng League", "Gauteng", "Various venues", "2021-06-05", "2021-09-11", "first_team_boys", [boysIds[0], boysIds[1], boysIds[9], boysIds[10], boysIds[11]]),
    mkTournament("t-girls-nationals", "Girls' National Champs", "National", "St Stithians Pool, Johannesburg", "2021-07-05", "2021-08-21", "first_team_girls", girlsIds),
  ];

  // Players & rosters — 13 caps per team.
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const FIRST = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "J.", "K.", "L.", "M.", "N."];
  const SURNAMES = ["Muller", "Naidoo", "Khumalo", "Louw", "Engelbrecht", "Patel", "Philips", "van Rensburg", "Dlamini", "Botha", "Jacobs", "Ngcobo", "Adams"];
  let playerSeq = 0;
  for (const team of [...boysTeams, ...girlsTeams]) {
    for (let cap = 1; cap <= 13; cap++) {
      playerSeq++;
      players.push({
        id: `pl-${playerSeq}`,
        school_id: team.school_id,
        name: `${FIRST[(playerSeq + cap) % FIRST.length]} ${SURNAMES[(playerSeq * 7 + cap) % SURNAMES.length]}`,
        position: cap === 1 ? "Goalkeeper" : cap <= 6 ? "Driver" : "Centre/Attacker",
        active: true,
      });
      rosters.push({
        id: `ros-${playerSeq}`,
        team_id: team.id,
        season_id: "season-2021",
        player_id: `pl-${playerSeq}`,
        cap_number: cap,
        is_goalkeeper: cap === 1,
      });
    }
  }

  // Matches: single round robin per tournament with deterministic results.
  const matches: Match[] = [];
  const events: MatchEvent[] = [];
  const baseClock = (): Match["clock"] => ({
    elapsed_ms: 0, running_since: null, period: 1, shot_elapsed_ms: 0, shot_running_since: null,
  });

  const capsOf = (teamId: string): number[] =>
    rosters.filter((r) => r.team_id === teamId).map((r) => r.cap_number);

  const mkMatches = (t: Tournament, teamIds: string[], startDay: number, liveScores?: { home: number; away: number }) => {
    const list = [...teamIds];
    const n = list.length;
    let seq = 0;
    for (let round = 0; round < n - 1; round++) {
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const homeId = list[i];
        const awayId = list[n - 1 - i];
        if (!homeId || !awayId || homeId === awayId) continue;
        seq++;
        const hour = 9 + (seq % 5);
        const scheduled = day(t.start_date, startDay + round, hour, (seq % 2) * 30);
        const id = `m-${t.id}-${seq}`;
        const isLive = !!liveScores && round === n - 2 && i === 0;
        const isUpcoming = !isLive && round >= n - 3;

        let match: Match;
        if (isLive && liveScores) {
          match = {
            id, tournament_id: t.id, season_id: t.season_id, home_team_id: homeId, away_team_id: awayId,
            scheduled_at: scheduled, venue: t.venue, round: `R${round + 1}`, pool_group_id: null,
            status: "live", home_score: liveScores.home, away_score: liveScores.away,
            clock: { ...baseClock(), elapsed_ms: 2 * 60 * 1000 + 48 * 1000, period: 3, shot_elapsed_ms: 6000 },
            possession: "home", started_at: scheduled, ended_at: null, verification: "unverified",
            periods: t.periods, period_length_ms: t.period_length_min * 60 * 1000, shot_clock_ms: t.shot_clock_seconds * 1000,
            flagged: false, created_at: now, updated_at: now,
          };
        } else if (isUpcoming) {
          match = {
            id, tournament_id: t.id, season_id: t.season_id, home_team_id: homeId, away_team_id: awayId,
            scheduled_at: scheduled, venue: t.venue, round: `R${round + 1}`, pool_group_id: null,
            status: "scheduled", home_score: 0, away_score: 0,
            clock: baseClock(), possession: null, started_at: null, ended_at: null, verification: "unverified",
            periods: t.periods, period_length_ms: t.period_length_min * 60 * 1000, shot_clock_ms: t.shot_clock_seconds * 1000,
            flagged: false, created_at: now, updated_at: now,
          };
        } else {
          const gf = Math.floor(rand() * 14) + 2;
          const ga = Math.floor(rand() * (gf + 2));
          match = {
            id, tournament_id: t.id, season_id: t.season_id, home_team_id: homeId, away_team_id: awayId,
            scheduled_at: scheduled, venue: t.venue, round: `R${round + 1}`, pool_group_id: null,
            status: "completed", home_score: gf, away_score: ga,
            clock: { ...baseClock(), elapsed_ms: t.period_length_min * 60 * 1000, period: t.periods },
            possession: null, started_at: scheduled, ended_at: scheduled, verification: "verified",
            periods: t.periods, period_length_ms: t.period_length_min * 60 * 1000, shot_clock_ms: t.shot_clock_seconds * 1000,
            flagged: false, created_at: now, updated_at: now,
          };
          // Goal events matching the score, spread across periods.
          let seqEvent = 0;
          const mkGoal = (teamId: string, period: number, remaining: number, cap: number) => {
            seqEvent++;
            events.push({
              id: `ev-${id}-${seqEvent}`, match_id: id, seq: seqEvent, period,
              game_clock_ms: remaining, team_id: teamId, player_id: null, player_cap: cap,
              secondary_player_id: null, category: "scoring", event_type: "goal", outcome: null,
              created_by: "seed", recorded_at: scheduled, deleted_at: null, correction_reason: null,
            });
          };
          const homeCaps = capsOf(homeId);
          const awayCaps = capsOf(awayId);
          for (let g = 1; g <= gf; g++) mkGoal(homeId, 1 + (g % t.periods), ((4 + g) % 6) * 60 * 1000, homeCaps[g % homeCaps.length]);
          for (let g = 1; g <= ga; g++) mkGoal(awayId, 1 + (g % t.periods), ((2 + g) % 6) * 60 * 1000, awayCaps[g % awayCaps.length]);
        }
        matches.push(match);
      }
      // rotate for round robin
      list.splice(1, 0, list.pop()!);
    }
  };

  mkMatches(tournaments[0], boysIds.slice(0, 8), 10);
  mkMatches(tournaments[1], boysIds.slice(2, 10), 31);
  mkMatches(tournaments[2], [boysIds[0], boysIds[1], boysIds[9], boysIds[10], boysIds[11]], 3, { home: 6, away: 4 });
  mkMatches(tournaments[3], girlsIds, 33, { home: 3, away: 3 });

  // Start the demo live matches' clocks so scoreboards move (demo presentation only).
  for (const m of matches.filter((x) => x.status === "live")) {
    m.clock = {
      ...m.clock,
      running_since: new Date(Date.now() - 60 * 1000).toISOString(),
      shot_running_since: new Date(Date.now() - 5 * 1000).toISOString(),
    };
  }

  // Users
  const users: UserProfile[] = [
    { id: "u-admin", email: "admin@demo.swpza", name: "A. Mokoena", roles: ["admin"], school_id: null, created_at: now },
    { id: "u-tourn", email: "tournament@demo.swpza", name: "T. Organiser", roles: ["tournament_admin"], school_id: null, created_at: now },
    { id: "u-score", email: "scorekeeper@demo.swpza", name: "S. Operator", roles: ["scorekeeper"], school_id: null, created_at: now },
    { id: "u-coach", email: "coach@demo.swpza", name: "C. van Wyk", roles: ["coach"], school_id: schoolByName("Selborne").id, created_at: now },
    { id: "u-analyst", email: "analyst@demo.swpza", name: "N. Analyst", roles: ["analyst"], school_id: null, created_at: now },
  ];
  const passwords: Record<string, string> = Object.fromEntries(users.map((u) => [u.email, DEMO_PASSWORD]));

  // Ranking configs (provisional weights, clearly labelled in the UI)
  const mkConfig = (id: string, category: string): RankingConfig => ({
    id, season_id: "season-2021", category, version: 1,
    win_rate_weight: 0.6, offensive_weight: 0.2, defensive_weight: 0.2, draw_value: 0.5, min_games: 6,
    status: "published", effective_from: "2021-06-01", created_by: "u-admin", created_at: now,
  });
  const ranking_configs: RankingConfig[] = [mkConfig("rc-boys-1", "first_team_boys"), mkConfig("rc-girls-1", "first_team_girls")];

  const buildSnapshot = (id: string, config: RankingConfig, filter: (m: Match) => boolean, calculatedAt: string): RankingSnapshot => {
    const categoryMatches = matches.filter(
      (m) => m.status === "completed" && teams.find((x) => x.id === m.home_team_id)?.category === config.category,
    );
    return {
      id, season_id: config.season_id, category: config.category, config_id: config.id,
      config_version: config.version, calculated_at: calculatedAt, published: true,
      rows: computeRankings({ teams: teams.filter((t) => t.category === config.category), matches: categoryMatches.filter(filter), config }),
    };
  };

  const midSeason = (m: Match) => Date.parse(m.scheduled_at) < Date.parse("2021-07-15");
  const ranking_snapshots: RankingSnapshot[] = [
    buildSnapshot("rs-boys-mid", ranking_configs[0], midSeason, day("2021-07-15", 0, 18)),
    buildSnapshot("rs-boys-cur", ranking_configs[0], () => true, day("2021-08-30", 0, 18)),
    buildSnapshot("rs-girls-mid", ranking_configs[1], midSeason, day("2021-07-15", 0, 18)),
    buildSnapshot("rs-girls-cur", ranking_configs[1], () => true, day("2021-08-30", 0, 18)),
  ];

  const audit_logs: AuditLog[] = [
    { id: "al-1", actor_id: "u-admin", actor_name: "A. Mokoena", action: "ranking.publish", entity: "ranking_snapshot", entity_id: "rs-boys-cur", detail: "Published First Team Boys ranking v1", created_at: day("2021-08-30", 0, 18) },
    { id: "al-2", actor_id: "u-admin", actor_name: "A. Mokoena", action: "ranking.publish", entity: "ranking_snapshot", entity_id: "rs-girls-cur", detail: "Published First Team Girls ranking v1", created_at: day("2021-08-30", 0, 18) },
    { id: "al-3", actor_id: "u-tourn", actor_name: "T. Organiser", action: "tournament.publish", entity: "tournament", entity_id: "t-ct-premier", detail: "Published fixtures", created_at: day("2021-06-10", 0, 9) },
  ];

  return {
    schools, teams, seasons, tournaments, entries, matches, events, players, rosters,
    ranking_configs, ranking_snapshots, users, passwords, audit_logs,
  };
}
