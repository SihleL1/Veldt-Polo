import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { EligibilityBadge } from "@/components/shared/RankingsTable";
import { MatchRow } from "@/components/shared/MatchBits";
import { EmptyState, ErrorState, LoadingState, ModeBanner, SectionHeader } from "@/components/shared/States";
import { categoryLabel } from "@/lib/domain/types";
import { computeTeamStats } from "@/lib/domain/stats";
import { useMatches, usePublishedRanking, useSeasons, useTeams, useTournaments } from "@/lib/hooks/useData";

export default function TeamProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: teams, isLoading } = useTeams();
  const view = (teams ?? []).find((v) => v.team.id === id);
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: matches } = useMatches({ seasonId: season?.id, teamId: id });
  const { data: ranking } = usePublishedRanking(season?.id, view?.team.category ?? "");
  const { data: tournaments } = useTournaments({ publishedOnly: true });

  if (isLoading) return <div className="min-h-screen bg-cream"><SiteHeader /><LoadingState /></div>;
  if (!view) return <div className="min-h-screen bg-cream"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-16"><ErrorState message="Team not found." /></main><SiteFooter /></div>;

  const { team, school } = view;
  const allMatches = matches ?? [];
  const stats = computeTeamStats(allMatches, team.id);
  const row = ranking?.current.rows.find((r) => r.team_id === team.id);
  const completed = allMatches.filter((m) => m.status === "completed").sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
  const upcoming = allMatches
    .filter((m) => m.status === "scheduled" || m.status === "live")
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const teamTournaments = (tournaments ?? []).filter((t) => t.category === team.category);

  const trend = completed
    .slice(0, 10)
    .reverse()
    .map((m, i) => {
      const isHome = m.home_team_id === team.id;
      return {
        match: `M${i + 1}`,
        for: isHome ? m.home_score : m.away_score,
        against: isHome ? m.away_score : m.home_score,
      };
    });

  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main>
        <section className="bg-forest-600 text-cream">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <Link to="/rankings" className="text-sm text-cream/70 hover:text-cream">← Back to rankings</Link>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">{school.name}</h1>
                <p className="mt-1 text-cream/75">{categoryLabel(team.category)} · {season?.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-cream/60">National rank</p>
                  <p className="font-data text-4xl font-bold">{row ? row.rank : "—"}</p>
                </div>
                <div className="font-sans">
                  {row ? <EligibilityBadge e={row.eligibility} /> : <span className="rounded bg-cream/20 px-2 py-1 text-xs">Not ranked</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
          <section aria-label="Season statistics" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-forest-600/15 bg-cream-deep shadow-sm sm:grid-cols-3 lg:grid-cols-6">
            <Stat value={`${stats.wins} – ${stats.draws} – ${stats.losses}`} label="Record" sub={`${stats.games_played} games`} />
            <Stat value={fmt(Math.round(stats.gf_per_game * 10) / 10)} label="GF / game" sub={`${stats.games_played} games`} />
            <Stat value={fmt(Math.round(stats.ga_per_game * 10) / 10)} label="GA / game" sub={`${stats.games_played} games`} />
            <Stat value={`${stats.goal_difference > 0 ? "+" : ""}${stats.goal_difference}`} label="Goal difference" sub={`${stats.games_played} games`} />
            <Stat value={row ? row.score.toFixed(3) : "—"} label="Ranking score" sub={row?.eligibility ?? "unranked"} />
            <Stat value={`${stats.games_played}`} label="Games played" sub="this season" />
          </section>

          {stats.games_played === 0 ? (
            <EmptyState
              title="No completed matches for this team yet"
              hint="Statistics and rankings appear once finalised results are recorded."
            />
          ) : (
            <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              <SectionHeader title="Goals for and against by match" sub="Performance trend, oldest to newest." />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE6D8" />
                    <XAxis dataKey="match" tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} />
                    <YAxis tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
                    <ReTooltip contentStyle={{ fontFamily: "Work Sans" }} />
                    <Legend />
                    <Line type="monotone" dataKey="for" name="Goals for" stroke="#234723" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="against" name="Goals against" stroke="#D8913B" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              <SectionHeader title="Recent results" />
              {completed.length === 0 ? <EmptyState title="No results yet" /> : (
                <table className="w-full text-sm">
                  <tbody>{completed.slice(0, 6).map((m) => <MatchRow key={m.id} match={m} showCompetition={false} />)}</tbody>
                </table>
              )}
            </div>
            <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              <SectionHeader title="Upcoming fixtures" />
              {upcoming.length === 0 ? <EmptyState title="No upcoming fixtures" /> : (
                <table className="w-full text-sm">
                  <tbody>{upcoming.slice(0, 6).map((m) => <MatchRow key={m.id} match={m} showCompetition={false} />)}</tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Tournament participation" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teamTournaments.map((t) => (
                <Link key={t.id} to={`/competitions/${t.slug}`} className="flex items-center justify-between rounded-lg border border-forest-600/15 bg-white p-4 shadow-sm hover:shadow-md">
                  <div>
                    <p className="font-semibold text-forest-950">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.venue}, {t.province} · {t.start_date}</p>
                  </div>
                  <span className="font-data text-sm text-muted-foreground">{t.status}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-white px-4 py-5 text-center">
      <p className="font-data text-2xl font-bold text-forest-950">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">({sub})</p>}
    </div>
  );
}
