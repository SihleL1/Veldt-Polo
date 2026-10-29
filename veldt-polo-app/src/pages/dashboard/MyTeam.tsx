import { Link } from "react-router-dom";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EligibilityBadge } from "@/components/shared/RankingsTable";
import { EmptyState, LoadingState, SectionHeader } from "@/components/shared/States";
import { MatchRow } from "@/components/shared/MatchBits";
import { useAuth } from "@/lib/auth";
import { categoryLabel } from "@/lib/domain/types";
import { computeTeamStats } from "@/lib/domain/stats";
import { useMatches, usePublishedRanking, useSeasons, useTeams } from "@/lib/hooks/useData";

/** Full ranking breakdown + match log for the signed-in coach's team. */
export default function DashboardTeam() {
  const { user } = useAuth();
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: teams, isLoading } = useTeams(user?.school_id ? { schoolId: user.school_id } : undefined);
  const { data: matches } = useMatches({ seasonId: season?.id });
  const { data: rankingBoys } = usePublishedRanking(season?.id, "first_team_boys");
  const { data: rankingGirls } = usePublishedRanking(season?.id, "first_team_girls");

  if (isLoading) return <DashboardShell title="My team"><LoadingState /></DashboardShell>;
  const view = (teams ?? [])[0];
  if (!view) {
    return (
      <DashboardShell title="My team">
        <EmptyState dark title="No team linked to your account" hint="Ask an administrator to link your account to a school." />
      </DashboardShell>
    );
  }

  const { team, school } = view;
  const teamMatches = (matches ?? []).filter((m) => m.home_team_id === team.id || m.away_team_id === team.id);
  const stats = computeTeamStats(teamMatches, team.id);
  const ranking = team.category === "first_team_boys" ? rankingBoys : rankingGirls;
  const row = ranking?.current.rows.find((r) => r.team_id === team.id);
  const rankRowOf = (snapIndex: 0 | 1, teamId: string) =>
    ranking && (snapIndex === 0 ? ranking.current : ranking.previous)?.rows.find((r) => r.team_id === teamId);
  const prevRow = ranking?.previous?.rows.find((r) => r.team_id === team.id);

  const completed = teamMatches.filter((m) => m.status === "completed").sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));

  return (
    <DashboardShell title={school.name} sub={`${categoryLabel(team.category)} · full private ranking breakdown`}>
      {row ? (
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <SectionHeader title="Ranking breakdown" sub={`Config version ${ranking?.current.config_version} · provisional scores scale with games played`} light />
          <div className="mt-4 flex items-center gap-3">
            <span className="font-data text-3xl font-bold text-ochre-400">#{row.rank}</span>
            <EligibilityBadge e={row.eligibility} />
            {prevRow && prevRow.rank !== row.rank && (
              <span className="text-xs text-cream/60">
                {row.rank < prevRow.rank ? `▲ up from #${prevRow.rank}` : `▼ down from #${prevRow.rank}`}
              </span>
            )}
          </div>
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-white/15 text-left text-[11px] uppercase tracking-wider text-cream/50">
                <th scope="col" className="py-1.5 font-semibold">Component</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Raw value</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Weight</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Contribution</th>
              </tr>
            </thead>
            <tbody className="font-data">
              <BreakdownRow label="Adjusted win rate" raw={row.adjusted_win_rate} weight={0.6} />
              <BreakdownRow label="Offensive efficiency" raw={row.offensive_efficiency} weight={0.2} />
              <BreakdownRow label="Defensive efficiency" raw={row.defensive_efficiency} weight={0.2} />
              <tr className="border-t border-white/15 font-bold text-cream">
                <td className="pt-2">Total score</td>
                <td />
                <td />
                <td className="pt-2 text-right">{row.score.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-cream/55">
            Win rate counts a draw as half a win. Offensive and defensive efficiency are normalised
            against the category's per-game scoring range, so a high-scoring category does not
            distort defence. Provisional teams (fewer than the minimum games) have their score
            scaled by games played ÷ minimum games.
          </p>
        </section>
      ) : (
        <EmptyState dark title="No published ranking yet" hint="Rankings appear once the administrator publishes a snapshot." />
      )}

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <SectionHeader title="Season metrics" light />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Record" value={`${stats.wins}-${stats.draws}-${stats.losses}`} />
          <Metric label="Games" value={`${stats.games_played}`} />
          <Metric label="Win rate (adj.)" value={`${Math.round(stats.adjusted_win_rate * 100)}%`} />
          <Metric label="GF / game" value={stats.gf_per_game.toFixed(1)} />
          <Metric label="GA / game" value={stats.ga_per_game.toFixed(1)} />
          <Metric label="Goal diff" value={`${stats.goal_difference > 0 ? "+" : ""}${stats.goal_difference}`} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <SectionHeader title="Match log" sub="Every completed match this season, newest first." light />
        {completed.length === 0 ? (
          <EmptyState dark title="No completed matches yet" />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/15 bg-black/20 text-left text-[11px] uppercase tracking-wider text-cream/50">
                  <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Home</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Score</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Away</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Competition</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-cream/85">
                {completed.map((m) => (
                  <MatchRow key={m.id} match={m} showCompetition dark />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-cream/50">
          Full public history: <Link to={`/teams/${team.id}`} className="text-ochre-400 hover:underline">team page</Link>
        </p>
      </section>
    </DashboardShell>
  );
}

function BreakdownRow({ label, raw, weight }: { label: string; raw: number; weight: number }) {
  return (
    <tr className="border-b border-white/10 text-cream/85">
      <td className="py-1.5 font-sans">{label}</td>
      <td className="py-1.5 text-right">{raw.toFixed(3)}</td>
      <td className="py-1.5 text-right text-cream/60">{Math.round(weight * 100)}%</td>
      <td className="py-1.5 text-right">{(raw * weight).toFixed(3)}</td>
    </tr>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2.5">
      <p className="font-data text-xl font-bold text-cream">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-cream/50">{label}</p>
    </div>
  );
}

