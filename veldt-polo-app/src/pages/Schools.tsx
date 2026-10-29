import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { EmptyState, LoadingState, ModeBanner } from "@/components/shared/States";
import { useMatches, useSchools, useTeams } from "@/lib/hooks/useData";
import { computeTeamStats } from "@/lib/domain/stats";
import { Input } from "@/components/ui/input";

export default function Schools() {
  const { data: schools, isLoading } = useSchools();
  const { data: teams } = useTeams();
  const { data: matches } = useMatches();
  const [q, setQ] = useState("");

  const provinces = useMemo(() => [...new Set((schools ?? []).map((s) => s.province))].sort(), [schools]);
  const filtered = (schools ?? []).filter(
    (s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.province.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-950">Schools & Teams</h1>
        <p className="mt-1 text-muted-foreground">
          {provinces.length > 0 ? `${filtered.length} schools across ${provinces.length} provinces` : "Water polo schools across South Africa"}
        </p>
        <div className="mt-6 max-w-sm">
          <Input
            type="search"
            placeholder="Search schools or provinces…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search schools"
            className="border-forest-600/25 bg-white"
          />
        </div>
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No schools match your search" hint="Try a shorter search, or clear it to see all schools." />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => {
              const schoolTeams = (teams ?? []).filter((v) => v.school.id === s.id && v.team.active);
              const teamIds = schoolTeams.map((v) => v.team.id);
              const schoolMatches = (matches ?? []).filter((m) => teamIds.includes(m.home_team_id) || teamIds.includes(m.away_team_id));
              const stats = teamIds.map((id) => computeTeamStats(schoolMatches, id)).reduce(
                (acc, st) => ({ gp: acc.gp + st.games_played, w: acc.w + st.wins }),
                { gp: 0, w: 0 },
              );
              return (
                <Link
                  key={s.id}
                  to={`/schools/${s.slug}`}
                  className="group rounded-xl border border-forest-600/15 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-forest-950 group-hover:text-forest-600">{s.name}</h2>
                    <span className="shrink-0 rounded bg-forest-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-forest-600">{s.province}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {s.city}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {schoolTeams.map((v) => (
                      <span key={v.team.id} className="rounded bg-cream px-2 py-0.5 text-[11px] font-medium text-forest-800">
                        {v.team.name.replace(s.name, "").trim() || v.team.name}
                      </span>
                    ))}
                  </div>
                  {stats.gp > 0 && (
                    <p className="mt-3 font-data text-xs text-muted-foreground">
                      {stats.gp} matches · {stats.w} wins
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
