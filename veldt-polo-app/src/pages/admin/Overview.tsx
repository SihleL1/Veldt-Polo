import { Link } from "react-router-dom";
import { AdminPage, DarkTable, Td } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useAuditLogs, useMatches, useSchools, useSeasons, useTeams, useTournaments, useUsers } from "@/lib/hooks/useData";

export default function AdminOverview() {
  const { data: schools } = useSchools();
  const { data: teams } = useTeams();
  const { data: seasons } = useSeasons();
  const { data: tournaments } = useTournaments();
  const { data: matches } = useMatches();
  const { data: users } = useUsers();
  const { data: audit, isLoading: auditLoading } = useAuditLogs();

  const season = seasons?.[0];
  const counts = [
    { label: "Schools", value: schools?.length ?? 0, to: "/admin/schools" },
    { label: "Teams", value: teams?.length ?? 0, to: "/admin/teams" },
    { label: "Tournaments", value: tournaments?.length ?? 0, to: "/admin/tournaments" },
    { label: "Matches", value: matches?.length ?? 0, to: "/admin/fixtures" },
    { label: "Users", value: users?.length ?? 0, to: "/admin/users" },
  ];
  const live = (matches ?? []).filter((m) => m.status === "live").length;
  const unverified = (matches ?? []).filter((m) => m.status === "completed" && m.verification === "unverified").length;
  const disputed = (matches ?? []).filter((m) => m.verification === "disputed").length;

  return (
    <AdminPage
      title="Admin overview"
      sub={season ? `Managing ${season.name}. Everything an administrator does here is audited and role-checked in the database.` : "Administration"}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counts.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-ochre-500/50">
            <p className="font-data text-3xl font-bold text-cream">{c.value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-cream/55">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AttentionCard label="Matches live right now" value={live} to="/score" hint="Open the scoring console list" />
        <AttentionCard label="Completed but unverified" value={unverified} to="/admin/fixtures" hint="Verify before rankings publication" />
        <AttentionCard label="Disputed results" value={disputed} to="/admin/fixtures" hint="Resolve before they feed rankings" />
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-bold text-cream">Workflow in brief</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-cream/75">
          <li>Create the season, then schools and teams under <Link to="/admin/schools" className="text-ochre-400 hover:underline">Schools</Link> and <Link to="/admin/teams" className="text-ochre-400 hover:underline">Teams</Link>.</li>
          <li>Schedule a tournament under <Link to="/admin/tournaments" className="text-ochre-400 hover:underline">Tournaments</Link>, add entries, then fixtures under <Link to="/admin/fixtures" className="text-ochre-400 hover:underline">Fixtures &amp; matches</Link>.</li>
          <li>Scorekeepers run matches in the live console; finalisation reconciles scores with the event log.</li>
          <li>Set ranking weights per category under <Link to="/admin/rankings" className="text-ochre-400 hover:underline">Rankings config</Link>, preview, then publish a snapshot.</li>
        </ol>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-cream">Recent activity</h2>
        {auditLoading ? (
          <LoadingState />
        ) : !audit || audit.length === 0 ? (
          <EmptyState dark title="No audit activity yet" />
        ) : (
          <DarkTable headers={["When", "Actor", "Action", "Detail"]} caption="Recent audit log entries">
            {audit.slice(0, 8).map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <Td mono className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</Td>
                <Td>{l.actor_name}</Td>
                <Td mono className="text-xs">{l.action}</Td>
                <Td className="text-xs text-cream/60">{l.detail}</Td>
              </tr>
            ))}
          </DarkTable>
        )}
      </div>
    </AdminPage>
  );
}

function AttentionCard({ label, value, to, hint }: { label: string; value: number; to: string; hint: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-ochre-500/50">
      <p className="font-data text-2xl font-bold text-cream">{value}</p>
      <p className="mt-1 text-xs font-semibold text-cream/80">{label}</p>
      <p className="text-[11px] text-cream/50">{hint}</p>
    </Link>
  );
}
