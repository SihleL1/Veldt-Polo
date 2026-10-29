import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPage, DarkField, DarkTable, Td, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { repo } from "@/lib/data";
import { qk } from "@/lib/hooks/useData";
import { useSeasons } from "@/lib/hooks/useData";

export default function AdminSeasons() {
  const { data: seasons, isLoading } = useSeasons();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !start || !end) {
      setError("Season name, start date and end date are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.upsertSeason({ name: name.trim(), start_date: start, end_date: end, status: "upcoming" });
      setName("");
      setStart("");
      setEnd("");
      await queryClient.invalidateQueries({ queryKey: qk.seasons });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the season.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title="Seasons"
      sub="A season scopes every tournament, match, ranking config and snapshot. Rankings are always per season and category — seasons never mix."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DarkField label="Season name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 Season" className={inputCls} />
        </DarkField>
        <DarkField label="Start date">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </DarkField>
        <DarkField label="End date">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Saving…" : "Add season"}
          </Button>
        </div>
        {error && <p className="sm:col-span-4 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : !seasons || seasons.length === 0 ? (
          <EmptyState dark title="No seasons yet" hint="Create the first season above." />
        ) : (
          <DarkTable headers={["Season", "Start", "End", "Status"]} caption="Seasons">
            {seasons.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <Td className="font-medium">{s.name}</Td>
                <Td mono>{s.start_date}</Td>
                <Td mono>{s.end_date}</Td>
                <Td mono className="text-xs">
                  <span className={s.status === "active" ? "text-ochre-300" : s.status === "completed" ? "text-cream/50" : "text-emerald-300"}>{s.status}</span>
                </Td>
              </tr>
            ))}
          </DarkTable>
        )}
      </div>
    </AdminPage>
  );
}
