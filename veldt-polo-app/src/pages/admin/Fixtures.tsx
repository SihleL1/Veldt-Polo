import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, DarkField, DarkTable, Td, ghostBtnCls, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { StatusBadge, formatKickoff } from "@/components/shared/MatchBits";
import { repo } from "@/lib/data";
import { qk, useMatches, useSeasons, useTeams, useTournaments } from "@/lib/hooks/useData";
import { categoryLabel } from "@/lib/domain/types";
import type { Verification } from "@/lib/domain/types";

export default function AdminFixtures() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: tournaments } = useTournaments({ seasonId: season?.id });
  const { data: teams } = useTeams();
  const { data: matches, isLoading } = useMatches({ seasonId: season?.id });
  const queryClient = useQueryClient();

  const [tournamentId, setTournamentId] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("");
  const [round, setRound] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const teamById = useMemo(() => new Map((teams ?? []).map((v) => [v.team.id, v])), [teams]);
  const filtered = useMemo(() => {
    const list = matches ?? [];
    const f = filterStatus === "all" ? list : list.filter((m) => m.status === filterStatus);
    return [...f].sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
  }, [matches, filterStatus]);

  async function create() {
    const tournament = (tournaments ?? []).find((t) => t.id === tournamentId);
    if (!tournament || !homeId || !awayId || !when) {
      setError("Choose a tournament, both teams and a date/time. Create the tournament first if none exist.");
      return;
    }
    if (homeId === awayId) {
      setError("A team cannot play itself.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.createMatch({
        tournament_id: tournament.id,
        season_id: tournament.season_id,
        home_team_id: homeId,
        away_team_id: awayId,
        scheduled_at: new Date(when).toISOString(),
        venue: venue.trim(),
        round: round.trim() || null,
        status: "scheduled",
        home_score: 0,
        away_score: 0,
        periods: tournament.periods,
        period_length_ms: tournament.period_length_min * 60_000,
        shot_clock_ms: tournament.shot_clock_seconds * 1000,
      });
      setWhen("");
      await queryClient.invalidateQueries({ queryKey: qk.matches({ seasonId: season?.id }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule the match.");
    } finally {
      setBusy(false);
    }
  }

  async function setVerification(id: string, verification: Verification) {
    let reason = "";
    if (verification === "disputed") reason = prompt("Reason for disputing this result?") ?? "";
    if (verification === "disputed" && !reason.trim()) return;
    await repo
      .setVerification(id, verification, reason || "Verified by administrator", { id: "admin", name: "Administrator" })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not update verification."));
    await queryClient.invalidateQueries({ queryKey: qk.matches({ seasonId: season?.id }) });
  }

  return (
    <AdminPage
      title="Fixtures & matches"
      sub="Schedule matches into a tournament, then track status and result verification. Disputed matches are excluded from rankings until resolved."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DarkField label="Tournament">
          <Select value={tournamentId} onValueChange={setTournamentId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Select tournament…" /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {(tournaments ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({categoryLabel(t.category)})</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="Home team">
          <Select value={homeId} onValueChange={setHomeId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Home…" /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {(teams ?? []).map((v) => <SelectItem key={v.team.id} value={v.team.id}>{v.school.name} ({categoryLabel(v.team.category)})</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="Away team">
          <Select value={awayId} onValueChange={setAwayId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Away…" /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {(teams ?? []).map((v) => <SelectItem key={v.team.id} value={v.team.id}>{v.school.name} ({categoryLabel(v.team.category)})</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="Date & time">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
        </DarkField>
        <DarkField label="Venue / round">
          <div className="flex gap-2">
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className={inputCls} />
            <Input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Rd" className={inputCls + " w-20"} />
          </div>
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Saving…" : "Schedule"}
          </Button>
        </div>
        {error && <p className="lg:col-span-6 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-cream/60">Filter</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className={inputCls + " w-44"}><SelectValue /></SelectTrigger>
          <SelectContent className="border-white/20 bg-forest-950 text-cream">
            {["all", "scheduled", "live", "paused", "completed", "disputed-filter"].map((s) =>
              s === "disputed-filter" ? null : <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>,
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState dark title="No matches found" hint="Schedule matches above, or adjust the filter." />
        ) : (
          <DarkTable headers={["Date", "Match", "Score", "Status", "Verification", "Console"]} caption="Season matches">
            {filtered.map((m) => {
              const k = formatKickoff(m.scheduled_at);
              return (
                <tr key={m.id} className="border-t border-white/5">
                  <Td mono className="whitespace-nowrap text-xs">{k.date} {k.time}</Td>
                  <Td>
                    <span className="font-medium">{m.home_school.name}</span>
                    <span className="text-cream/50"> vs </span>
                    <span className="font-medium">{m.away_school.name}</span>
                    <span className="block text-[11px] text-cream/50">{m.tournament_name}{m.round ? ` · ${m.round}` : ""}</span>
                  </Td>
                  <Td mono className="text-center font-bold">
                    {m.status === "scheduled" ? "—" : `${m.home_score}–${m.away_score}`}
                  </Td>
                  <Td><StatusBadge status={m.status} verification={m.verification} /></Td>
                  <Td className="text-right">
                    {m.status === "completed" ? (
                      <span className="inline-flex gap-1.5">
                        {(["verified", "unverified", "disputed"] as Verification[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => void setVerification(m.id, v)}
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                              m.verification === v ? "bg-ochre-500 font-bold text-forest-950" : "border border-white/20 text-cream/70 hover:bg-white/10"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-cream/40">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link to={`/score/${m.id}`} className="text-xs font-semibold text-ochre-400 hover:underline">Console →</Link>
                  </Td>
                </tr>
              );
            })}
          </DarkTable>
        )}
      </div>
      <p className="mt-3 text-xs text-cream/50">
        Team lookups resolve through the tournament's category; cross-category fixtures are prevented at the database level
        ({(teamById.size)} teams available). Results verification appears once a match is finalised in the console.
      </p>
    </AdminPage>
  );
}
