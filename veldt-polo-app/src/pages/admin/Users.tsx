import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPage, DarkField, DarkTable, Td, inputCls } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { repo } from "@/lib/data";
import { qk, useSchools, useUsers } from "@/lib/hooks/useData";
import { ROLE_LABELS, type Role } from "@/lib/domain/types";

const ALL_ROLES: Role[] = ["admin", "tournament_admin", "scorekeeper", "coach", "analyst"];

export default function AdminUsers() {
  const { data: users, isLoading } = useUsers();
  const { data: schools } = useSchools();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["scorekeeper"]);
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (!email.trim() || !name.trim() || roles.length === 0) {
      setError("Email, name and at least one role are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.inviteUser({ email: email.trim().toLowerCase(), name: name.trim(), roles }, { id: me?.id ?? "admin", name: me?.name ?? "Administrator" });
      setEmail("");
      setName("");
      await queryClient.invalidateQueries({ queryKey: qk.users });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not invite the user.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(userId: string, current: Role[], role: Role) {
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    if (next.length === 0) return; // a user must keep at least one role
    await repo.setUserRoles(userId, next, { id: me?.id ?? "admin", name: me?.name ?? "Administrator" }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: qk.users });
  }

  return (
    <AdminPage
      title="Users & roles"
      sub="Invite operators and set roles. In production, roles are enforced again by Row Level Security on every database query — this screen only shapes who is invited to what."
    >
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[1.5fr_1.5fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <DarkField label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@school.org.za" className={inputCls} />
        </DarkField>
        <DarkField label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
        </DarkField>
        <DarkField label="School (coach / analyst scope)">
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className={`h-9 w-full rounded border px-2 text-sm ${inputCls}`}
            aria-label="School scope"
          >
            <option value="">Platform-wide</option>
            {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </DarkField>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
            {busy ? "Inviting…" : "Invite user"}
          </Button>
        </div>
        <div className="lg:col-span-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-cream/60">Roles</p>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => {
              const active = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoles(active ? roles.filter((x) => x !== r) : [...roles, r])}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active ? "border-ochre-500 bg-ochre-500 text-forest-950" : "border-white/20 text-cream/70 hover:bg-white/10"
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="lg:col-span-4 text-sm text-red-300">{error}</p>}
      </form>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : !users || users.length === 0 ? (
          <EmptyState dark title="No users yet" hint="Invite the first scorekeeper or coach above." />
        ) : (
          <DarkTable headers={["User", "Email", "Roles (click to toggle)", "School scope"]} caption="Users and roles">
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <Td className="font-medium">
                  {u.name}
                  {u.id === me?.id && <span className="ml-2 rounded bg-ochre-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ochre-300">you</span>}
                </Td>
                <Td mono className="text-xs">{u.email}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {ALL_ROLES.map((r) => {
                      const active = u.roles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => void toggleRole(u.id, u.roles, r)}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                            active ? "border-ochre-500 bg-ochre-500/20 font-bold text-ochre-300" : "border-white/15 text-cream/40 hover:bg-white/10"
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </span>
                </Td>
                <Td className="text-xs">{u.school_id ? (schools ?? []).find((s) => s.id === u.school_id)?.name ?? u.school_id : "Platform-wide"}</Td>
              </tr>
            ))}
          </DarkTable>
        )}
      </div>
      <DarkField label="">
        <span className="text-[11px] text-cream/40">
          Invited users receive sign-in instructions by email in production. In demonstration mode, accounts exist only in this browser's dataset.
        </span>
      </DarkField>
    </AdminPage>
  );
}
