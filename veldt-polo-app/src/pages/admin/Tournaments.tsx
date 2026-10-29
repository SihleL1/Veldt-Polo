import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, DarkField, DarkTable, Td, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { repo } from "@/lib/data";
import { qk, useEntries, useSeasons, useTeams, useTournaments } from "@/lib/hooks/useData";
import { TEAM_CATEGORIES, categoryLabel } from "@/lib/domain/types";

export default function AdminTournaments() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: tournaments, isLoading } = useTournaments({ seasonId: season?.id });
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(TEAM_CATEGORIES[0].id);
  const [startDate, setStartDate] = useState("");
  const [venue, setVenue] = useState("");
  const [province, setProvince] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openEntries, setOpenEntries] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !season || !startDate || !province.trim()) {
      setError("Tournament name, start date and province are required (and an active season must exist).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.upsertTournament({
        name: name.trim(),
        season_id: season.id,
        category,
        start_date: startDate,
        end_date: startDate,
        venue: venue.trim(),
        province: province.trim(),
        status: "scheduled",
        published: false,
        periods: 4,
        period_length_min: 7,
        shot_clock_seconds: 30,
      });
      setName("");
      setVenue("");
      await queryClient.invalidateQueries({ queryKey: qk.tournaments({ seasonId: season.id }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title="Tournaments"
      sub="Tournaments group matches and carry the competition rules (periods, period length, shot clock). Publishing makes a tournament and its fixtures public."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DarkField label="Tournament name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cape Town Premier Tournament" className={inputCls} />
        </DarkField>
        <DarkField label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {TEAM_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </DarkField>
        <DarkField label="Venue">
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className={inputCls} />
        </DarkField>
        <DarkField label="Province">
          <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Province" className={inputCls} />
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Saving…" : "Add"}
          </Button>
        </div>
        {error && <p className="sm:col-span-6 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : !tournaments || tournaments.length === 0 ? (
          <EmptyState dark title="No tournaments this season yet" />
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-cream">{t.name}</p>
                    <p className="mt-0.5 text-xs text-cream/55">
                      {categoryLabel(t.category)} · {t.venue || "Venue TBC"}, {t.province} · {t.start_date} · {t.entry_count} teams · {t.periods} × {t.period_length_min} min, {t.shot_clock_seconds}s shot clock
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] uppercase tracking-wider ${t.published ? "text-emerald-300" : "text-cream/40"}`}>
                      {t.published ? "published" : "draft"}
                    </span>
                    <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream" onClick={() => setOpenEntries(openEntries === t.id ? null : t.id)}>
                      Entries
                    </Button>
                    <Button
                      size="sm"
                      className={t.published ? "border border-white/20 bg-transparent text-cream hover:bg-white/10" : "bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400"}
                      onClick={async () => {
                        await repo.setTournamentPublished(t.id, !t.published).catch(() => undefined);
                        await queryClient.invalidateQueries({ queryKey: qk.tournaments({ seasonId: season?.id }) });
                      }}
                    >
                      {t.published ? "Unpublish" : "Publish"}
                    </Button>
                  </div>
                </div>
                {openEntries === t.id && <EntriesPanel tournamentId={t.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminPage>
  );
}

function EntriesPanel({ tournamentId }: { tournamentId: string }) {
  const { data: entries, isLoading } = useEntries(tournamentId);
  const { data: teams } = useTeams();
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState("");
  const [group, setGroup] = useState("");

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-cream/60">Entries</p>
      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <ul className="mt-2 space-y-1 text-sm">
            {(entries ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span className="text-cream/85">{e.school_name} — {e.team_name}{e.group_name ? ` · ${e.group_name}` : ""}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-cream/70 hover:bg-white/10 hover:text-cream"
                  onClick={async () => {
                    await repo.removeEntry(e.id).catch(() => undefined);
                    await queryClient.invalidateQueries({ queryKey: qk.entries(tournamentId) });
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
            {(entries ?? []).length === 0 && <li className="text-cream/50">No entries yet — add teams below.</li>}
          </ul>
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!teamId) return;
              await repo.addEntry(tournamentId, teamId, group.trim() || null).catch(() => undefined);
              setTeamId("");
              setGroup("");
              await queryClient.invalidateQueries({ queryKey: qk.entries(tournamentId) });
            }}
          >
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className={inputCls + " w-64"}><SelectValue placeholder="Add team…" /></SelectTrigger>
              <SelectContent className="border-white/20 bg-forest-950 text-cream">
                {(teams ?? []).map((v) => <SelectItem key={v.team.id} value={v.team.id}>{v.school.name} ({categoryLabel(v.team.category)})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Pool group (optional)" className={inputCls + " w-44"} />
            <Button type="submit" className="bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">Add entry</Button>
          </form>
        </>
      )}
    </div>
  );
}
