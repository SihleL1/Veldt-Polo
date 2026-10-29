import { useParams } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { MatchRow } from "@/components/shared/MatchBits";
import { EmptyState, ErrorState, LoadingState, ModeBanner, SectionHeader } from "@/components/shared/States";
import { categoryLabel } from "@/lib/domain/types";
import { useMatches, useSeasons, useTournamentByParam, useEntries } from "@/lib/hooks/useData";

export default function CompetitionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: t, isLoading, error } = useTournamentByParam(slug);
  const { data: matches, isLoading: lm } = useMatches({ tournamentId: t?.id });
  const { data: entries } = useEntries(t?.id ?? "");
  const { data: seasons } = useSeasons();
  const seasonName = seasons?.find((s) => s.id === t?.season_id)?.name;

  if (isLoading) return <div className="min-h-screen bg-cream"><SiteHeader /><LoadingState /></div>;
  if (error || !t) return <div className="min-h-screen bg-cream"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-16"><ErrorState message="Competition not found." /></main><SiteFooter /></div>;

  const sorted = [...(matches ?? [])].sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main>
        <section className="bg-forest-600 text-cream">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-ochre-300">{t.province || "South Africa"}</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{t.name}</h1>
            <p className="mt-2 text-cream/75">
              {seasonName} · {categoryLabel(t.category)} · {t.venue}
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
          <section>
            <SectionHeader title={`Participating teams (${entries?.length ?? 0})`} />
            {entries && entries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entries.map((e) => (
                  <span key={e.id} className="rounded-full border border-forest-600/20 bg-white px-3 py-1 text-sm font-medium">{e.school_name}</span>
                ))}
              </div>
            ) : <EmptyState title="Entries not yet confirmed" />}
          </section>
          <section>
            <SectionHeader title="Fixtures & results" sub={`${sorted.length} matches`} />
            <div className="rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
              {lm ? <LoadingState /> : sorted.length === 0 ? (
                <EmptyState title="No fixtures published yet" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-forest-600/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="py-2 pl-2 pr-3 font-semibold">Date</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Home</th>
                      <th scope="col" className="py-2 font-semibold">Score</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Away</th>
                      <th scope="col" className="py-2 pr-2 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>{sorted.map((m) => <MatchRow key={m.id} match={m} showCompetition={false} />)}</tbody>
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
