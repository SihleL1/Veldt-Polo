import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { EmptyState, LoadingState, ModeBanner, SectionHeader } from "@/components/shared/States";
import { sortLeaders } from "@/lib/domain/stats";
import { TEAM_CATEGORIES } from "@/lib/domain/types";
import { useMatches, useSeasons, useTeams } from "@/lib/hooks/useData";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MetricKey = "gf_per_game" | "ga_per_game" | "goal_difference" | "adjusted_win_rate";

const METRICS: { key: MetricKey; label: string; desc: string; dir: "desc" | "asc"; fmt: (n: number) => string }[] = [
  { key: "gf_per_game", label: "Goals scored per game", desc: "Offensive output — higher is better.", dir: "desc", fmt: (n) => n.toFixed(1) },
  { key: "ga_per_game", label: "Goals conceded per game", desc: "Defensive record — lower is better.", dir: "asc", fmt: (n) => n.toFixed(1) },
  { key: "goal_difference", label: "Goal difference", desc: "Goals for minus goals against, season total.", dir: "desc", fmt: (n) => (n > 0 ? `+${n}` : `${n}`) },
  { key: "adjusted_win_rate", label: "Win rate", desc: "Draws count as half a win.", dir: "desc", fmt: (n) => `${Math.round(n * 100)}%` },
];

export default function Statistics() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const [category, setCategory] = useState<string>("first_team_boys");
  const [minGames, setMinGames] = useState(3);
  const { data: teams } = useTeams({ category });
  const { data: matches, isLoading } = useMatches({ seasonId: season?.id });
  const teamIds = (teams ?? []).map((v) => v.team.id);
  const nameOf = (id: string) => (teams ?? []).find((v) => v.team.id === id)?.school.name ?? id;

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-950">Statistics & Leaders</h1>
        <p className="mt-1 text-muted-foreground">
          Team-level leaders for {season?.name}. Per-game averages keep teams with different match counts
          comparable — the games behind every figure are always shown.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {TEAM_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Minimum games</Label>
            <Select value={`${minGames}`} onValueChange={(v) => setMinGames(Number(v))}>
              <SelectTrigger className="w-36 bg-white font-data"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {[1, 3, 5, 8].map((n) => <SelectItem key={n} value={`${n}`}>{n}+</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : !matches || matches.length === 0 ? (
          <div className="mt-8"><EmptyState title="No matches this season yet" /></div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {METRICS.map((metric) => {
              const leaders = sortLeaders(matches, teamIds, (s) => s[metric.key], metric.dir, minGames).slice(0, 8);
              return (
                <div key={metric.key} className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
                  <SectionHeader title={metric.label} sub={metric.desc} />
                  {leaders.length === 0 ? (
                    <EmptyState title={`No teams with at least ${minGames} completed matches`} hint="Lower the minimum games filter to include provisional teams." />
                  ) : (
                    <ol className="space-y-1.5">
                      {leaders.map((e, i) => (
                        <li key={e.teamId} className="flex items-baseline justify-between gap-3 border-b border-cream-deep py-1.5 last:border-0">
                          <span className="min-w-0 truncate text-sm">
                            <span className="font-data mr-2 w-5 text-muted-foreground">{i + 1}.</span>
                            <Link to={`/teams/${e.teamId}`} className="font-medium hover:underline">{nameOf(e.teamId)}</Link>
                          </span>
                          <span className="shrink-0 font-data text-sm">
                            <span className="font-semibold">{metric.fmt(e.value)}</span>
                            <span className="ml-1.5 text-[10px] text-muted-foreground">{e.gamesPlayed} GP</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
