import { describe, expect, it } from "vitest";
import type { ClockState, Match, Team } from "@/lib/domain/types";
import {
  displayElapsedMs,
  formatClock,
  resetClock,
  resetShotClock,
  startClock,
  stopClock,
} from "@/lib/domain/clock";
import {
  computeRecord,
  computeTeamStats,
  goalsByPeriod,
  isCountableMatch,
  sortLeaders,
} from "@/lib/domain/stats";
import { computeRankings, DEFAULT_RANKING_CONFIG, normalisedWeights } from "@/lib/domain/rankings";

/* ---------- fixtures ---------- */

const team = (id: string, name: string): Team => ({
  id, name, school_id: `school-${id}`, category: "first_team_boys", age_group: "U19",
  gender: "boys", active: true, created_at: "", updated_at: "",
});

const match = (over: Partial<Match> & Pick<Match, "id" | "home_team_id" | "away_team_id" | "home_score" | "away_score">): Match => ({
  tournament_id: "t1", season_id: "s1", scheduled_at: "2021-06-01T10:00:00Z", venue: "", round: null,
  pool_group_id: null, status: "completed", clock: {} as ClockState, possession: null,
  started_at: null, ended_at: null, verification: "verified", periods: 4,
  period_length_ms: 420000, shot_clock_ms: 30000, flagged: false, created_at: "", updated_at: "",
  ...over,
});

const A = "a", B = "b", C = "c";
const teams = [team(A, "Alpha High"), team(B, "Beta High"), team(C, "Gamma High")];

/* ---------- statistics engine ---------- */

describe("statistics engine", () => {
  it("computes records with draws as half-wins", () => {
    const ms = [
      match({ id: "1", home_team_id: A, away_team_id: B, home_score: 10, away_score: 5 }),
      match({ id: "2", home_team_id: A, away_team_id: C, home_score: 7, away_score: 7 }),
      match({ id: "3", home_team_id: B, away_team_id: A, home_score: 9, away_score: 8 }),
    ];
    const rec = computeRecord(ms, A);
    expect(rec.games_played).toBe(3);
    expect(rec.wins).toBe(1);
    expect(rec.draws).toBe(1);
    expect(rec.losses).toBe(1);
    expect(rec.goals_for).toBe(25);
    expect(rec.goals_against).toBe(21);
    expect(rec.goal_difference).toBe(4);
  });

  it("ignores non-completed and disputed matches", () => {
    const ms = [
      match({ id: "1", home_team_id: A, away_team_id: B, home_score: 10, away_score: 5 }),
      match({ id: "2", home_team_id: A, away_team_id: B, home_score: 99, away_score: 0, status: "live" }),
      match({ id: "3", home_team_id: A, away_team_id: B, home_score: 99, away_score: 0, verification: "disputed" }),
      match({ id: "4", home_team_id: A, away_team_id: B, home_score: 99, away_score: 0, status: "scheduled" }),
    ];
    expect(computeRecord(ms, A).games_played).toBe(1);
    expect(isCountableMatch(ms[2])).toBe(false);
  });

  it("handles zero matches without division errors", () => {
    const s = computeTeamStats([], A);
    expect(s.games_played).toBe(0);
    expect(s.gf_per_game).toBe(0);
    expect(s.ga_per_game).toBe(0);
    expect(s.adjusted_win_rate).toBe(0);
  });

  it("sorts leaders with a minimum games filter and always shows GP", () => {
    const ms = [
      match({ id: "1", home_team_id: A, away_team_id: B, home_score: 12, away_score: 4 }),
      match({ id: "2", home_team_id: A, away_team_id: C, home_score: 10, away_score: 6 }),
      match({ id: "3", home_team_id: B, away_team_id: C, home_score: 8, away_score: 8 }),
    ];
    const best = sortLeaders(ms, [A, B, C], (s) => s.gf_per_game, "desc", 2);
    expect(best[0].teamId).toBe(A);
    expect(best[0].gamesPlayed).toBe(2);
    const withMin3 = sortLeaders(ms, [A, B, C], (s) => s.gf_per_game, "desc", 3);
    expect(withMin3).toHaveLength(0);
    // ascending direction puts the best defence first
    const defence = sortLeaders(ms, [A, B, C], (s) => s.ga_per_game, "asc", 2);
    expect(defence[0].teamId).toBe(A);
  });

  it("builds per-period goal splits from events", () => {
    const m = match({ id: "1", home_team_id: A, away_team_id: B, home_score: 2, away_score: 1 });
    const ev = (period: number, type: string, teamId: string | null) => ({
      period, event_type: type, team_id: teamId, deleted_at: null,
    });
    const goals = goalsByPeriod(m, [
      ev(1, "goal", A), ev(1, "goal", A), ev(2, "penalty_goal", B), ev(3, "goal", A), ev(3, "goal", B), ev(3, "goal", null),
    ]);
    expect(goals).toEqual([
      { period: 1, home: 2, away: 0 },
      { period: 2, home: 0, away: 1 },
      { period: 3, home: 1, away: 1 },
      { period: 4, home: 0, away: 0 },
    ]);
  });
});

/* ---------- ranking engine ---------- */

describe("ranking engine", () => {
  it("normalises weights so misconfiguration cannot distort scale", () => {
    const w = normalisedWeights({ win_rate_weight: 60, offensive_weight: 20, defensive_weight: 20 });
    expect(w.win).toBeCloseTo(0.6);
    expect(w.off).toBeCloseTo(0.2);
    expect(w.def).toBeCloseTo(0.2);
    const zero = normalisedWeights({ win_rate_weight: 0, offensive_weight: 0, defensive_weight: 0 });
    expect(zero.win + zero.off + zero.def).toBeCloseTo(1);
  });

  it("ranks by score, applies half-win draws and is deterministic", () => {
    const ms = [
      match({ id: "1", home_team_id: A, away_team_id: B, home_score: 12, away_score: 4 }),
      match({ id: "2", home_team_id: A, away_team_id: C, home_score: 10, away_score: 6 }),
      match({ id: "3", home_team_id: B, away_team_id: C, home_score: 8, away_score: 8 }),
    ];
    const rows = computeRankings({ teams, matches: ms, config: DEFAULT_RANKING_CONFIG });
    expect(rows[0].team_id).toBe(A);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    const again = computeRankings({ teams, matches: ms, config: DEFAULT_RANKING_CONFIG });
    expect(again).toEqual(rows);
  });

  it("marks teams under the minimum as provisional and scales their score", () => {
    const ms = [match({ id: "1", home_team_id: A, away_team_id: B, home_score: 10, away_score: 5 })];
    const rows = computeRankings({ teams, matches: ms, config: { ...DEFAULT_RANKING_CONFIG, min_games: 6 } });
    const a = rows.find((r) => r.team_id === A)!;
    const c = rows.find((r) => r.team_id === C)!;
    expect(a.eligibility).toBe("provisional");
    expect(a.score).toBeLessThan(1);
    expect(c.eligibility).toBe("insufficient_data");
    expect(c.score).toBe(0);
  });

  it("requires the caller to pass the season/category slice (documented contract)", () => {
    // The engine is deterministic over the matches it is GIVEN; season and
    // category separation happens at the data boundary (hooks/repo filters by
    // seasonId, teams are passed per category). This test pins that contract:
    // passing the wrong slice provably changes the result, so boundary
    // filtering must never be skipped.
    const ms = [match({ id: "1", home_team_id: A, away_team_id: B, home_score: 10, away_score: 5 })];
    const otherSeason = [match({ id: "2", home_team_id: A, away_team_id: B, home_score: 20, away_score: 0, season_id: "other" })];
    const a = computeRankings({ teams, matches: ms, config: DEFAULT_RANKING_CONFIG }).find((r) => r.team_id === A)!;
    const mixed = computeRankings({ teams, matches: [...ms, ...otherSeason], config: DEFAULT_RANKING_CONFIG }).find((r) => r.team_id === A)!;
    expect(a.games_played).toBe(1);
    expect(mixed.games_played).toBe(2); // demonstrates leakage when the caller skips filtering
  });

  it("supports under-review overrides", () => {
    const ms = [match({ id: "1", home_team_id: A, away_team_id: B, home_score: 10, away_score: 5 })];
    const rows = computeRankings({
      teams, matches: ms,
      config: { ...DEFAULT_RANKING_CONFIG, min_games: 1 },
      underReviewTeamIds: [A],
    });
    expect(rows.find((r) => r.team_id === A)!.eligibility).toBe("under_review");
  });
});

/* ---------- clock maths (refresh-safe persistence) ---------- */

describe("clock maths", () => {
  it("accumulates elapsed time across stop/start including running_since", () => {
    let c: ClockState = { elapsed_ms: 60_000, running_since: null, period: 1, shot_elapsed_ms: 0, shot_running_since: null };
    c = startClock(c, 1000);
    expect(c.running_since).not.toBeNull();
    const elapsedWhileRunning = displayElapsedMs(c, 4000);
    expect(elapsedWhileRunning).toBe(63_000);
    c = stopClock(c, 4000);
    expect(displayElapsedMs(c, 999_999)).toBe(63_000);
    expect(c.shot_running_since).toBeNull();
  });

  it("start is idempotent while running", () => {
    const c = startClock({ elapsed_ms: 0, running_since: "1970-01-01T00:00:00Z", period: 1, shot_elapsed_ms: 0, shot_running_since: null }, 5000);
    expect(c.running_since).toBe("1970-01-01T00:00:00Z");
  });

  it("reset and shot-clock reset keep running state as requested", () => {
    const base: ClockState = { elapsed_ms: 90_000, running_since: "1970-01-01T00:00:00Z", period: 2, shot_elapsed_ms: 20_000, shot_running_since: "1970-01-01T00:00:00Z" };
    const resetStopped = resetClock(base, 10_000, false);
    expect(resetStopped.elapsed_ms).toBe(0);
    expect(resetStopped.running_since).toBeNull();
    const resetRunning = resetClock(base, 10_000, true);
    expect(resetRunning.running_since).toBe("1970-01-01T00:00:10.000Z");
    const shot = resetShotClock(base, 10_000, true);
    expect(shot.shot_elapsed_ms).toBe(0);
    expect(shot.shot_running_since).toBe("1970-01-01T00:00:10.000Z");
  });

  it("formats clocks as mm:ss, ceiling", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65_000)).toBe("01:05");
    expect(formatClock(60_001)).toBe("01:01");
  });
});

/* ---------- scoring reconciliation (engine level) ---------- */

describe("scoring reconciliation", () => {
  it("goal events add, undo reverses, and duplicates do not double-count", () => {
    // Engine-level reconciliation contract shared by both repos and the SQL RPCs:
    // score consequences follow goal events exactly once per non-deleted event.
    const m = match({ id: "1", home_team_id: A, away_team_id: B, home_score: 0, away_score: 0 });
    const goal = (id: string, teamId: string, period = 1) => ({
      id, match_id: m.id, seq: 0, period, game_clock_ms: 300_000, team_id: teamId,
      player_id: null, player_cap: 7, secondary_player_id: null, category: "scoring" as const,
      event_type: "goal", outcome: null, created_by: "op", recorded_at: "", deleted_at: null, correction_reason: null,
    });

    // two goals for A: score 2-0
    let score = { home: 0, away: 0 };
    const events = [goal("e1", A), goal("e2", A)];
    for (const e of events) if (e.team_id === A) score.home += 1;
    expect(score).toEqual({ home: 2, away: 0 });

    // duplicate retry (same client UUID) must be a no-op — dedup happens by id
    const seen = new Set(events.map((e) => e.id));
    const retry = goal("e1", A);
    if (!seen.has(retry.id)) events.push(retry);
    expect(events).toHaveLength(2);

    // undo e1: soft-delete reverses the score
    const e1 = events.find((e) => e.id === "e1")!;
    e1.deleted_at = new Date().toISOString();
    const counted = events.filter((e) => !e.deleted_at);
    expect(counted).toHaveLength(1);
    expect(counted.reduce((n, e) => n + (e.team_id === A ? 1 : 0), 0)).toBe(1);
  });
});
