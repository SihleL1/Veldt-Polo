import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, DarkField, DarkTable, Td, ghostBtnCls, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { repo } from "@/lib/data";
import { qk, useSchools } from "@/lib/hooks/useData";

const PROVINCE_LIST = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

export default function AdminSchools() {
  const { data: schools, isLoading } = useSchools();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("Co-educational");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("School name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.upsertSchool({ name: name.trim(), province: province || "Unknown", city: city.trim(), type: type || null });
      setName("");
      setCity("");
      await queryClient.invalidateQueries({ queryKey: qk.schools });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the school.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await repo.archiveSchool(id, !active).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: qk.schools });
  }

  return (
    <AdminPage
      title="Schools"
      sub="Register participating schools. Archiving hides a school from new fixtures without deleting its history — historical results always remain."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DarkField label="School name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Selborne College" className={inputCls} />
        </DarkField>
        <DarkField label="Province">
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {PROVINCE_LIST.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <DarkField label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputCls} />
        </DarkField>
        <DarkField label="Type">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              {["Boys", "Girls", "Co-educational"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Saving…" : "Add school"}
          </Button>
        </div>
        {error && <p className="sm:col-span-5 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : !schools || schools.length === 0 ? (
          <EmptyState dark title="No schools registered yet" hint="Add the first school above." />
        ) : (
          <DarkTable headers={["School", "Province", "City", "Type", "Status", "Actions"]} caption="Registered schools">
            {schools.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.province}</Td>
                <Td>{s.city}</Td>
                <Td>{s.type}</Td>
                <Td mono className="text-xs">
                  {s.active ? <span className="text-emerald-300">active</span> : <span className="text-cream/40">archived</span>}
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="outline" className={ghostBtnCls} onClick={() => void toggleActive(s.id, s.active)}>
                    {s.active ? "Archive" : "Restore"}
                  </Button>
                </Td>
              </tr>
            ))}
          </DarkTable>
        )}
      </div>
    </AdminPage>
  );
}
