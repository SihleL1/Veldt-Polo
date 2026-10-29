import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, LoadingState, SectionHeader } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { categoryLabel } from "@/lib/domain/types";
import { computeTeamStats } from "@/lib/domain/stats";
import { useMatches, usePublishedRanking, useSeasons, useTeams } from "@/lib/hooks/useData";

/** Private analyst view: season trends, peer comparison, data-completeness warnings. */
export default function DashboardAnalytics() {
  const { user } = useAuth();
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: teams, isLoading } = useTeams(user?.school_id ? { schoolId: user.school_id } : undefined);
  const { data: matches } = useMatches({ seasonId: season?.id });
  const { data: rankingBoys } = usePublishedRanking(season?.id, "first_team_boys");
  const { data: rankingGirls } = usePublishedRanking(season?.id, "first_team_girls");

  if (isLoading) return <DashboardShell title="Analytics" sub={season?.name}><LoadingState /></DashboardShell>;
  const view = (teams ?? [])[0];
  if (!view) {
    return (
      <DashboardShell title="Analytics">
        <EmptyState dark title="No team linked to your account" hint="Ask an administrator to link your account to a school." />
      </DashboardShell>
    );
  }

  const { team, school } = view;
  const teamMatches = (matches ?? []).filter((m) => m.home_team_id === view.team.id || m.away_team_id === view.team.id);
  const stats = computeTeamStats(teamMatches, team.id);
  const ranking = team.category === "first_team_boys" ? rankingBoys : rankingGirls;
  const row = ranking?.current.rows.find((r) => r.team_id === team.id);

  const completed = teamMatches
    .filter((m) => m.status === "completed")
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

  const trend = completed.map((m, i) => {
    const isHome = m.home_team_id === team.id;
    return {
      match: `M${i + 1}`,
      "Goals for": isHome ? m.home_score : m.away_score,
      "Goals against": isHome ? m.away_score : m.home_score,
    };
  });

  const seasonTotals = {
    f: stats.goals_for,
    a: stats.goals_against,
    n: stats.games_played,
  };

  // Data completeness warnings (honest, no estimation).
  const warnings: string[] = [];
  if (seasonTotals.n > 0) {
    const unverified = completed.filter((m) => m.verification === "unverified").length;
    const disputed = completed.filter((m) => m.verification === "disputed").length;
    if (unverified > 0) warnings.push(`${unverified} completed match(es) are still marked unverified — confirm results with the tournament office before relying on them.`);
    if (disputed > 0) warnings.push(`${disputed} match(es) are disputed. Disputed matches are excluded from rankings until resolved.`);
    if (seasonTotals.n < 6) warnings.push(`Only ${seasonTotals.n} completed match(es) — the team's ranking score is provisional until the minimum games are reached.`);
    if (row && row.eligibility === "insufficient_data") warnings.push("The published ranking marks this team as having insufficient data.");
  } else {
    warnings.push("No completed matches this season yet — analytics will fill in as results are finalised.");
  }

  // Peer comparison within the category, from the published ranking snapshot.
  const peers = ranking?.current.rows.slice(0, 12) ?? [];
  const peerChart = peers.map((r) => ({
    team: r.team_id === team.id ? `${school.name.split(" ")[0]} (you)` : `#${r.rank}`,
    gf: Number(r.gf_per_game.toFixed(1)),
    ga: Number(r.ga_per_game.toFixed(1)),
  }));

  return (
    <DashboardShell title="Analytics" sub={`${school.name} · ${categoryLabel(team.category)} · ${season?.name ?? ""}`}>
      {warnings.length > 0 && (
        <div className="rounded-xl border border-ochre-500/40 bg-ochre-500/10 p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-ochre-300">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Data-completeness warnings
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-cream/80">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {completed.length === 0 ? (
        <div className="mt-6"><EmptyState dark title="Nothing to analyse yet" hint="Charts appear once matches are completed and finalised." /></div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <SectionHeader title="Goals for and against by match" light />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="match" tick={{ fontSize: 12, fontFamily: "JetBrains Mono", fill: "rgba(244,241,232,0.6)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fontFamily: "JetBrains Mono", fill: "rgba(244,241,232,0.6)" }} />
                  <ReTooltip contentStyle={{ background: "#0B1D12", border: "1px solid rgba(255,255,255,0.15)", color: "#F4F1E8" }} />
                  <Legend />
                  <Line type="monotone" dataKey="Goals for" stroke="#D8913B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Goals against" stroke="#8FB09B" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <SectionHeader
              title="Per-game scoring against the category"
              sub={`Goals for and against per game, top ${peers.length} ranked teams in ${categoryLabel(team.category)}.`}
              light
            />
            {peers.length === 0 ? (
              <EmptyState dark title="No published ranking to compare against" />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peerChart} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="team" tick={{ fontSize: 10, fill: "rgba(244,241,232,0.6)" }} angle={-35} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fontFamily: "JetBrains Mono", fill: "rgba(244,241,232,0.6)" }} />
                    <ReTooltip contentStyle={{ background: "#0B1D12", border: "1px solid rgba(255,255,255,0.15)", color: "#F4F1E8" }} />
                    <Legend />
                    <Bar dataKey="gf" name="Goals for / game" fill="#D8913B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ga" name="Goals against / game" fill="#35683A" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-4">
            <Card label="Goals scored" value={`${seasonTotals.f}`} sub={`${stats.gf_per_game.toFixed(1)} per game`} />
            <Card label="Goals conceded" value={`${seasonTotals.a}`} sub={`${stats.ga_per_game.toFixed(1)} per game`} />
            <Card label="Adjusted win rate" value={`${Math.round(stats.adjusted_win_rate * 100)}%`} sub="draws = half win" />
            <Card label="Ranking score" value={row ? row.score.toFixed(3) : "—"} sub={row ? `rank #${row.rank} · ${row.eligibility.replace("_", " ")}` : "not ranked"} />
          </section>

          <p className="text-xs leading-relaxed text-cream/50">
            Period-by-period scoring splits live on each{" "}
            <Link to={`/matches/${completed[completed.length - 1]?.id ?? ""}`} className="text-ochre-400 hover:underline">match report</Link>{" "}
            once goal events are captured. Season aggregates here use finalised scores only.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="font-data text-2xl font-bold text-cream">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-cream/60">{label}</p>
      <p className="text-[11px] text-cream/45">{sub}</p>
    </div>
  );
}
