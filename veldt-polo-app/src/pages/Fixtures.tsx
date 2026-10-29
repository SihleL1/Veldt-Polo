import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { MatchRow } from "@/components/shared/MatchBits";
import { EmptyState, LoadingState, ModeBanner } from "@/components/shared/States";
import { useMatches, useSeasons, useTournaments } from "@/lib/hooks/useData";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Fixtures() {
  const { data: seasons } = useSeasons();
  const [seasonId, setSeasonId] = useState<string>("all");
  const [tournamentId, setTournamentId] = useState<string>("all");
  const { data: tournaments } = useTournaments();
  const { data: matches, isLoading } = useMatches({
    status: "scheduled",
    seasonId: seasonId === "all" ? undefined : seasonId,
    tournamentId: tournamentId === "all" ? undefined : tournamentId,
  });
  const sorted = [...(matches ?? [])].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-950">Fixtures</h1>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Season</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All seasons</SelectItem>
                {(seasons ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Competition</Label>
            <Select value={tournamentId} onValueChange={setTournamentId}>
              <SelectTrigger className="w-56 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All competitions</SelectItem>
                {(tournaments ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
          {isLoading ? (
            <LoadingState />
          ) : sorted.length === 0 ? (
            <EmptyState title="No fixtures match these filters" hint="Try another season or competition." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-forest-600/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-2 pl-2 pr-3 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Home</th>
                  <th scope="col" className="py-2 font-semibold">Kick-off</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Away</th>
                  <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">Competition</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>{sorted.map((m) => <MatchRow key={m.id} match={m} showCompetition />)}</tbody>
            </table>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
