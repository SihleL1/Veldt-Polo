import { Link, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { MatchRow } from "@/components/shared/MatchBits";
import { EmptyState, ErrorState, LoadingState, ModeBanner, SectionHeader } from "@/components/shared/States";
import { categoryLabel } from "@/lib/domain/types";
import { useMatches, useSchools, useTeams } from "@/lib/hooks/useData";

export default function SchoolProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: schools, isLoading: ls } = useSchools();
  const school = schools?.find((s) => s.slug === slug || s.id === slug);
  const { data: allTeams, isLoading: lt } = useTeams();
  const teams = (allTeams ?? []).filter((v) => v.school.id === school?.id);
  const teamIds = teams.map((v) => v.team.id);
  const { data: matches, isLoading: lm } = useMatches();

  if (ls) return <div className="min-h-screen bg-cream"><SiteHeader /><LoadingState /></div>;
  if (!school) return <div className="min-h-screen bg-cream"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-16"><ErrorState message="School not found." /></main><SiteFooter /></div>;

  const schoolMatches = (matches ?? []).filter(
    (m) => teamIds.includes(m.home_team_id) || teamIds.includes(m.away_team_id),
  );
  const completed = schoolMatches.filter((m) => m.status === "completed");
  const upcoming = schoolMatches
    .filter((m) => m.status === "scheduled" || m.status === "live")
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main>
        <section className="bg-forest-800 text-cream">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-ochre-300">{school.province}</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{school.name}</h1>
            <p className="mt-2 flex items-center gap-2 text-cream/70">
              <MapPin className="h-4 w-4" /> {school.city}, {school.province}
              {school.type && <span>· {school.type} school</span>}
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
          <section>
            <SectionHeader title="Water polo teams" />
            {lt ? <LoadingState /> : teams.length === 0 ? (
              <EmptyState title="No teams registered for this school yet" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((v) => (
                  <Link key={v.team.id} to={`/teams/${v.team.id}`} className="rounded-lg border border-forest-600/15 bg-white p-4 shadow-sm hover:shadow-md">
                    <p className="font-semibold text-forest-950">{categoryLabel(v.team.category)}</p>
                    <p className="text-xs text-muted-foreground">{v.team.age_group} · View team profile →</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              <SectionHeader title="Recent results" sub={`${completed.length} completed matches on record`} />
              {lm ? <LoadingState /> : completed.length === 0 ? (
                <EmptyState title="No completed matches yet" />
              ) : (
                <table className="w-full text-sm">
                  <tbody>{completed.slice(0, 8).map((m) => <MatchRow key={m.id} match={m} showCompetition />)}</tbody>
                </table>
              )}
            </div>
            <div className="rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              <SectionHeader title="Upcoming & live" />
              {lm ? <LoadingState /> : upcoming.length === 0 ? (
                <EmptyState title="No upcoming fixtures" />
              ) : (
                <table className="w-full text-sm">
                  <tbody>{upcoming.slice(0, 8).map((m) => <MatchRow key={m.id} match={m} showCompetition />)}</tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
