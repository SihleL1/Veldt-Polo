import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { EmptyState, LoadingState, ModeBanner } from "@/components/shared/States";
import { categoryLabel } from "@/lib/domain/types";
import { useSeasons, useTournaments } from "@/lib/hooks/useData";

export function Competitions() {
  const { data: tournaments, isLoading } = useTournaments({ publishedOnly: true });
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-950">Competitions</h1>
        <p className="mt-1 text-muted-foreground">Published tournaments and leagues across South Africa.</p>
        {isLoading ? (
          <LoadingState />
        ) : (tournaments ?? []).length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No published competitions yet" hint="Published tournaments appear here with their fixtures and results." />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(tournaments ?? []).map((t) => (
              <Link
                key={t.id}
                to={`/competitions/${t.slug}`}
                className="group flex flex-col rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                  <span className="rounded bg-forest-50 px-2 py-0.5 font-mono text-forest-600">{t.province || "National"}</span>
                  <span className="text-muted-foreground">{categoryLabel(t.category)}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-forest-950 group-hover:text-forest-600">{t.name}</h2>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {t.start_date} → {t.end_date}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {t.venue || "Venues to be confirmed"}</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4" /> {t.entry_count} teams</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
