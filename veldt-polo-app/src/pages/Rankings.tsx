import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { RankingsTable } from "@/components/shared/RankingsTable";
import { EmptyState, LoadingState, ModeBanner } from "@/components/shared/States";
import { rankMovement } from "@/lib/domain/rankings";
import { TEAM_CATEGORIES, categoryLabel } from "@/lib/domain/types";
import { usePublishedRanking, useSeasons, useSnapshots, useTeams } from "@/lib/hooks/useData";
import { isDemoMode } from "@/lib/data";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LINE_COLORS = ["#234723", "#35683A", "#D8913B", "#8FB492"];

export default function Rankings() {
  const { data: seasons } = useSeasons();
  const [seasonId, setSeasonId] = useState<string>("");
  const [category, setCategory] = useState<string>("first_team_boys");

  useEffect(() => {
    if (seasons && seasons.length > 0 && !seasonId) setSeasonId(seasons[0].id);
  }, [seasons, seasonId]);

  const { data: ranking, isLoading } = usePublishedRanking(seasonId || undefined, category);
  const { data: snapshots } = useSnapshots({ publishedOnly: true, seasonId: seasonId || undefined, category });
  const { data: teams } = useTeams({ category });
  const teamNames = useMemo(
    () => new Map((teams ?? []).map((v) => [v.team.id, { name: v.school.name, teamId: v.team.id }])),
    [teams],
  );
  const movement = ranking ? rankMovement(ranking.current.rows, ranking.previous?.rows ?? null) : new Map();

  // Trend series: every published snapshot for this season+category, oldest first.
  const trend = useMemo(() => {
    const series = [...(snapshots ?? [])].sort((a, b) => Date.parse(a.calculated_at) - Date.parse(b.calculated_at));
    const topFour = ranking ? ranking.current.rows.slice(0, 4).map((r) => r.team_id) : [];
    return series.map((s, i) => {
      const point: Record<string, number | string> = { snapshot: `#${i + 1}` };
      for (const teamId of topFour) {
        const row = s.rows.find((r) => r.team_id === teamId);
        if (row) point[teamId] = row.score;
      }
      return point;
    });
  }, [snapshots, ranking]);

  const topFour = ranking ? ranking.current.rows.slice(0, 4) : [];

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main>
        <section className="bg-forest-600 text-cream">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-10 sm:px-6">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-ochre-300">South African Schools Water Polo</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight">National Rankings</h1>
              <p className="mt-1 text-cream/70">
                {categoryLabel(category)} · provisional methodology v{ranking?.current.config_version ?? 1}
                {isDemoMode() && " · demonstration data"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-cream/70">Season</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger className="w-44 border-cream/30 bg-forest-700 text-cream"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {(seasons ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-cream/70">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-48 border-cream/30 bg-forest-700 text-cream"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {TEAM_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
          {isLoading ? (
            <LoadingState label="Loading rankings" />
          ) : !ranking || ranking.current.rows.length === 0 ? (
            <EmptyState
              title="No rankings published for this season and category yet"
              hint="Rankings are calculated from finalised results and published by an administrator after a preview step."
            />
          ) : (
            <>
              <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
                <RankingsTable rows={ranking.current.rows} teamNames={teamNames} movement={movement} />
              </div>

              {trend.length > 1 && (
                <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-forest-950">Ranking score across published snapshots</h2>
                  <p className="text-sm text-muted-foreground">Top four teams, current snapshot order. Higher is better; 1.0 is the maximum.</p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EAE6D8" />
                        <XAxis dataKey="snapshot" tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} />
                        <YAxis domain={[0, 1]} tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} />
                        <ReTooltip contentStyle={{ fontFamily: "Work Sans" }} />
                        <Legend formatter={(v: string) => teamNames.get(v)?.name ?? v} />
                        {topFour.map((row, i) => (
                          <Line
                            key={row.team_id}
                            type="monotone"
                            dataKey={row.team_id}
                            stroke={LINE_COLORS[i % LINE_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-forest-950">How rankings are calculated</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The ranking score combines win rate, attacking output and defensive record. Draws count as
                    half a win. Components are normalised before weighting, so percentages and goal averages are
                    never mixed raw. Teams below the minimum games played have their score scaled down and are
                    marked provisional — thin evidence cannot claim a full national position.
                  </p>
                  <p className="mt-3 text-sm font-medium text-forest-800">Current methodology (provisional — not an official national rule):</p>
                  <ul className="mt-2 grid gap-1 font-data text-sm text-forest-950 sm:grid-cols-3">
                    <li className="rounded bg-forest-50 px-3 py-2">Win rate 60%</li>
                    <li className="rounded bg-forest-50 px-3 py-2">Offence 20%</li>
                    <li className="rounded bg-forest-50 px-3 py-2">Defence 20%</li>
                  </ul>
                  <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Snapshot calculated {new Date(ranking.current.calculated_at).toLocaleDateString("en-ZA", { dateStyle: "long" })} ·
                      methodology version {ranking.current.config_version}.{" "}
                      <Link to="/statistics" className="underline">Full metric definitions</Link>
                    </span>
                  </p>
                </div>
                <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-forest-950">Eligibility</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li><span className="font-semibold text-forest-800">Eligible</span> — at least the minimum games played this season.</li>
                    <li><span className="font-semibold text-ochre-600">Provisional</span> — fewer games than the threshold; score scaled down.</li>
                    <li><span className="font-semibold">Insufficient data</span> — no countable results yet.</li>
                    <li><span className="font-semibold">Under review</span> — results disputed or being corrected.</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
