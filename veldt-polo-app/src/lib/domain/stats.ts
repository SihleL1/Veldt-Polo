import type { Match, MatchView } from "./types";

/**
 * Statistics engine — pure functions over completed, non-disputed matches.
 * Derived statistics are always calculated; never stored redundantly.
 */

export interface TeamRecord {
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

export function isCountableMatch(m: Match): boolean {
  return m.status === "completed" && m.verification !== "disputed";
}

export function emptyRecord(): TeamRecord {
  return { games_played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_difference: 0 };
}

/** Accumulate one team's record from matches. Matches counted exactly once. */
export function computeRecord(matches: Match[], teamId: string): TeamRecord {
  const rec = emptyRecord();
  for (const m of matches) {
    if (!isCountableMatch(m)) continue;
    const isHome = m.home_team_id === teamId;
    const isAway = m.away_team_id === teamId;
    if (!isHome && !isAway) continue;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    rec.games_played += 1;
    rec.goals_for += gf;
    rec.goals_against += ga;
    if (gf > ga) rec.wins += 1;
    else if (gf === ga) rec.draws += 1;
    else rec.losses += 1;
  }
  rec.goal_difference = rec.goals_for - rec.goals_against;
  return rec;
}

/** Draws count as half a win. */
export function adjustedWinRate(rec: TeamRecord): number {
  if (rec.games_played === 0) return 0;
  return (rec.wins + 0.5 * rec.draws) / rec.games_played;
}

export interface TeamStats extends TeamRecord {
  gf_per_game: number;
  ga_per_game: number;
  win_rate: number;
  adjusted_win_rate: number;
}

export function computeTeamStats(matches: Match[], teamId: string): TeamStats {
  const rec = computeRecord(matches, teamId);
  return {
    ...rec,
    gf_per_game: rec.games_played ? rec.goals_for / rec.games_played : 0,
    ga_per_game: rec.games_played ? rec.goals_against / rec.games_played : 0,
    win_rate: rec.games_played ? rec.wins / rec.games_played : 0,
    adjusted_win_rate: adjustedWinRate(rec),
  };
}

/** Goals scored per period for a completed match (from events where captured). */
export function goalsByPeriod(match: Match, events: { period: number; event_type: string; team_id: string | null; deleted_at: string | null }[]): {
  period: number;
  home: number;
  away: number;
}[] {
  const periods = new Map<number, { home: number; away: number }>();
  for (let p = 1; p <= match.periods; p++) periods.set(p, { home: 0, away: 0 });
  for (const e of events) {
    if (e.deleted_at) continue;
    if (!["goal", "penalty_goal"].includes(e.event_type)) continue;
    if (!e.team_id) continue;
    const bucket = periods.get(e.period) ?? { home: 0, away: 0 };
    if (e.team_id === match.home_team_id) bucket.home += 1;
    else if (e.team_id === match.away_team_id) bucket.away += 1;
    periods.set(e.period, bucket);
  }
  return [...periods.entries()].map(([period, v]) => ({ period, ...v }));
}

/** Team-level leaders across a set of stats. Always shows games played. */
export interface LeaderEntry<T> {
  teamId: string;
  value: T;
  gamesPlayed: number;
}

export function sortLeaders<T extends number>(
  matches: Match[],
  teamIds: string[],
  value: (stats: TeamStats) => T,
  direction: "desc" | "asc" = "desc",
  requireGames = 1,
): LeaderEntry<T>[] {
  return teamIds
    .map((teamId) => {
      const stats = computeTeamStats(matches, teamId);
      return { teamId, value: value(stats), gamesPlayed: stats.games_played };
    })
    .filter((e) => e.gamesPlayed >= requireGames)
    .sort((a, b) => (direction === "desc" ? b.value - a.value : a.value - b.value) || a.teamId.localeCompare(b.teamId));
}

export function matchIsLive(m: MatchView | Match): boolean {
  return m.status === "live" || m.status === "paused";
}
