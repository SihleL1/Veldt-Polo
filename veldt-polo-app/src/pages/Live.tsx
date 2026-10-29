import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { LiveMatchCard } from "@/components/shared/MatchBits";
import { EmptyState, LoadingState, ModeBanner } from "@/components/shared/States";
import { useMatches } from "@/lib/hooks/useData";

export default function Live() {
  const { data: live, isLoading: l1 } = useMatches({ status: "live" });
  const { data: paused, isLoading: l2 } = useMatches({ status: "paused" });
  const all = [...(live ?? []), ...(paused ?? [])];
  const loading = l1 || l2;
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-950">Live matches</h1>
        <p className="mt-1 text-muted-foreground">Public scoreboards update as scorekeepers record events.</p>
        <div className="mt-8">
          {loading ? (
            <LoadingState label="Checking for live matches" />
          ) : all.length === 0 ? (
            <EmptyState
              title="Nothing in the water right now"
              hint="When a scorekeeper opens a match, the live scoreboard appears here with the running clock, score and event feed."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {all.map((m) => <LiveMatchCard key={m.id} match={m} />)}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
