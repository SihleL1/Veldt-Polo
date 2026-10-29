import { AdminPage, DarkTable, Td } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useAuditLogs } from "@/lib/hooks/useData";

export default function AdminAuditLogs() {
  const { data: logs, isLoading } = useAuditLogs(200);

  return (
    <AdminPage
      title="Audit logs"
      sub="Every privileged action — event corrections, verification changes, role changes, invitations and publications — is recorded with actor, entity and reason. Newest first."
    >
      {isLoading ? (
        <LoadingState />
      ) : !logs || logs.length === 0 ? (
        <EmptyState dark title="No audit entries yet" hint="Entries appear as administrators and operators act." />
      ) : (
        <DarkTable headers={["When", "Actor", "Action", "Entity", "Detail"]} caption="Audit log">
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-white/5">
              <Td mono className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "medium" })}</Td>
              <Td>{l.actor_name}</Td>
              <Td mono className="text-xs">{l.action}</Td>
              <Td mono className="text-xs text-cream/60">{l.entity}{l.entity_id ? ` · ${l.entity_id.slice(0, 12)}` : ""}</Td>
              <Td className="text-xs text-cream/70">{l.detail}</Td>
            </tr>
          ))}
        </DarkTable>
      )}
    </AdminPage>
  );
}
