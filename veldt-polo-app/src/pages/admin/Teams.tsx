import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, DarkField, DarkTable, Td, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { repo } from "@/lib/data";
import { qk } from "@/lib/hooks/useData";
import { TEAM_CATEGORIES, categoryLabel } from "@/lib/domain/types";
import { useSchools, useTeams } from "@/lib/hooks/useData";

export default function AdminTeams() {
  const { data: teams, isLoading } = useTeams();
  const { data: schools } = useSchools();
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState("");
  const [category, setCategory] = useState<string>(TEAM_CATEGORIES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!schoolId) {
      setError("Choose a school first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const school = schools?.find((s) => s.id === schoolId);
      const cat = TEAM_CATEGORIES.find((c) => c.id === category)!;
      await repo.upsertTeam({
        school_id: schoolId,
        name: `${school?.name ?? "Team"} ${cat.label}`,
        category,
        age_group: "U19",
        gender: cat.gender,
      });
      await queryClient.invalidateQueries({ queryKey: qk.teams });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title="Teams"
      sub="Teams belong to a school and compete in a category (first-team boys, first-team girls in this release). Rankings are computed per category, never across them."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[2fr_1.5fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DarkField label="School">
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Select school…" /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {(schools ?? []).filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {TEAM_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Saving…" : "Add team"}
          </Button>
        </div>
        {error && <p className="sm:col-span-3 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : !teams || teams.length === 0 ? (
          <EmptyState dark title="No teams yet" hint="Register schools first, then add their teams here." />
        ) : (
          <DarkTable headers={["Team", "School", "Category", "Age group", "Status"]} caption="Registered teams">
            {teams.map((v) => (
              <tr key={v.team.id} className="border-t border-white/5">
                <Td className="font-medium">{v.team.name}</Td>
                <Td>{v.school.name}</Td>
                <Td>{categoryLabel(v.team.category)}</Td>
                <Td mono>{v.team.age_group}</Td>
                <Td mono className="text-xs">
                  {v.team.active ? <span className="text-emerald-300">active</span> : <span className="text-cream/40">archived</span>}
                </Td>
              </tr>
            ))}
          </DarkTable>
        )}
      </div>
    </AdminPage>
  );
}
