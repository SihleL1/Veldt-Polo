import type { Eligibility, Match, RankingConfig, RankingRow, Team } from "./types";
import { computeTeamStats, isCountableMatch, adjustedWinRate } from "./stats";

/**
 * National rankings engine — deterministic and versioned.
 *
 * Methodology (provisional defaults, editable per season/category):
 *  - Adjusted win rate = (wins + draw_value × draws) / games played
 *  - Offensive efficiency = goals scored per game, min-max normalised within the
 *    season/category pool (0 = weakest, 1 = best).
 *  - Defensive efficiency = goals conceded per game, inverted then normalised:
 *    conceding fewer goals scores higher.
 *  - Score = win_rate_weight × adjWinRate + offensive_weight × offEff + defensive_weight × defEff
 *  - Teams below min_games are marked provisional: their score is scaled by
 *    games_played / min_games so thin evidence cannot outrank full evidence.
 *    Zero games = insufficient_data with score 0.
 *
 * Weights are normalised to sum to 1 before combining so a misconfigured
 * config can never distort the scale.
 */

export const DEFAULT_RANKING_CONFIG: Pick<
  RankingConfig,
  "win_rate_weight" | "offensive_weight" | "defensive_weight" | "draw_value" | "min_games"
> = {
  win_rate_weight: 0.6,
  offensive_weight: 0.2,
  defensive_weight: 0.2,
  draw_value: 0.5,
  min_games: 6,
};

export function normalisedWeights(config: Pick<RankingConfig, "win_rate_weight" | "offensive_weight" | "defensive_weight">) {
  const total = config.win_rate_weight + config.offensive_weight + config.defensive_weight;
  if (total <= 0) {
    return { win: 1 / 3, off: 1 / 3, def: 1 / 3 };
  }
  return {
    win: config.win_rate_weight / total,
    off: config.offensive_weight / total,
    def: config.defensive_weight / total,
  };
}

export interface RankInput {
  teams: Team[];
  matches: Match[];
  config: Pick<RankingConfig, "win_rate_weight" | "offensive_weight" | "defensive_weight" | "draw_value" | "min_games">;
  underReviewTeamIds?: string[];
}

export function computeRankings({ teams, matches, config, underReviewTeamIds = [] }: RankInput): RankingRow[] {
  const usable = matches.filter(isCountableMatch);
  const stats = teams.map((team) => ({ team, s: computeTeamStats(usable, team.id) }));

  const maxGf = Math.max(...stats.map((t) => t.s.gf_per_game), 0);
  const maxGa = Math.max(...stats.map((t) => t.s.ga_per_game), 0);
  const w = normalisedWeights(config);

  const rows: RankingRow[] = stats.map(({ team, s }) => {
    const awr =
      s.games_played === 0
        ? 0
        : (s.wins + config.draw_value * s.draws) / s.games_played;
    const offEff = maxGf > 0 ? s.gf_per_game / maxGf : 0;
    const defEff = maxGa > 0 ? 1 - s.ga_per_game / maxGa : 1;

    let eligibility: Eligibility;
    let score = w.win * awr + w.off * offEff + w.def * defEff;
    if (underReviewTeamIds.includes(team.id)) {
      eligibility = "under_review";
    } else if (s.games_played === 0) {
      eligibility = "insufficient_data";
      score = 0;
    } else if (s.games_played < config.min_games) {
      eligibility = "provisional";
      score = score * (s.games_played / config.min_games);
    } else {
      eligibility = "eligible";
    }

    return {
      team_id: team.id,
      games_played: s.games_played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      adjusted_win_rate: awr,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      goal_difference: s.goal_difference,
      gf_per_game: s.gf_per_game,
      ga_per_game: s.ga_per_game,
      offensive_efficiency: offEff,
      defensive_efficiency: defEff,
      score: round4(score),
      rank: 0,
      eligibility,
    };
  });

  // Deterministic ordering: score desc, then goal difference, goals for, name.
  const nameOf = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? teamId;
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      nameOf(a.team_id).localeCompare(nameOf(b.team_id)),
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export function eligibilityLabel(e: Eligibility): string {
  switch (e) {
    case "eligible":
      return "Eligible";
    case "provisional":
      return "Provisional";
    case "insufficient_data":
      return "Insufficient data";
    case "under_review":
      return "Under review";
  }
}

/** Movement of a team between two published snapshots. */
export function rankMovement(current: RankingRow[], previous: RankingRow[] | null): Map<string, number> {
  const moves = new Map<string, number>();
  if (!previous) return moves;
  const prevRank = new Map(previous.map((r) => [r.team_id, r.rank]));
  for (const row of current) {
    const prev = prevRank.get(row.team_id);
    if (prev !== undefined) moves.set(row.team_id, prev - row.rank);
  }
  return moves;
}
