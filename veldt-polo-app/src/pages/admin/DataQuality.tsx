import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminPage, DarkTable, Td } from "./shared";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useMatches, useSeasons, useTeams } from "@/lib/hooks/useData";
import { GOAL_EVENT_TYPES } from "@/lib/domain/events";
import { repo } from "@/lib/data";
import { useEffect, useState } from "react";

interface Finding {
  severity: "error" | "warning";
  matchId?: string;
  message: string;
}

/**
 * Data-quality checks: score/event reconciliation and verification hygiene.
 * Checks run over data the admin can read; nothing is estimated silently.
 */
export default function AdminDataQuality() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: matches, isLoading } = useMatches({ seasonId: season?.id });
  const { data: teams } = useTeams();
  const [eventCounts, setEventCounts] = useState<Map<string, { goals: number; total: number }> | null>(null);

  useEffect(() => {
    let mounted = true;
    const list = matches ?? [];
    (async () => {
      const map = new Map<string, { goals: number; total: number }>();
      await Promise.all(
        list.map(async (m) => {
          try {
            const events = await repo.listEvents(m.id);
            const counted = events.filter((e) => !e.deleted_at);
            map.set(m.id, {
              goals: counted.filter((e) => GOAL_EVENT_TYPES.includes(e.event_type)).length,
              total: counted.length,
            });
          } catch {
            map.set(m.id, { goals: 0, total: 0 });
          }
        }),
      );
      if (mounted) setEventCounts(map);
    })();
    return () => {
      mounted = false;
    };
  }, [matches]);

  const findings = useMemo<Finding[]>(() => {
    if (!matches || !eventCounts) return [];
    const out: Finding[] = [];
    for (const m of matches) {
      const label = `${m.home_school.name} vs ${m.away_school.name}`;
      if (m.status === "completed" && m.verification === "unverified") {
        out.push({ severity: "warning", matchId: m.id, message: `${label} is finalised but unverified — verify or dispute before rankings publication.` });
      }
      if (m.verification === "disputed") {
        out.push({ severity: "error", matchId: m.id, message: `${label} is DISPUTED and excluded from rankings until resolved.` });
      }
      if (m.status === "live") {
        out.push({ severity: "warning", matchId: m.id, message: `${label} is still live — has the console been closed without finalising?` });
      }
      const ec = eventCounts.get(m.id);
      const goalSum = m.home_score + m.away_score;
      if (m.status === "completed" && goalSum > 0 && ec && ec.goals > 0 && ec.goals !== goalSum) {
        out.push({ severity: "error", matchId: m.id, message: `${label}: score ${m.home_score}–${m.away_score} does not reconcile with ${ec.goals} recorded goal events.` });
      }
      if (m.status === "completed" && goalSum > 0 && ec && ec.total === 0) {
        out.push({ severity: "warning", matchId: m.id, message: `${label} has no event log — result-only record (period breakdown unavailable).` });
      }
    }
    for (const v of teams ?? []) {
      const hasMatch = (matches ?? []).some((m) => m.home_team_id === v.team.id || m.away_team_id === v.team.id);
      if (!hasMatch) {
        out.push({ severity: "warning", message: `${v.school.name} (${v.team.name}) has no scheduled matches this season.` });
      }
    }
    return out;
  }, [matches, teams, eventCounts]);

  if (isLoading || !eventCounts) return <AdminPage title="Data quality"><LoadingState label="Running checks" /></AdminPage>;

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");

  return (
    <AdminPage
      title="Data quality"
      sub="Automated checks over this season's data: score/event reconciliation, verification hygiene and coverage gaps. Fixes happen at the source — the scoring console or fixtures screen."
    >
      {findings.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          All checks pass for {season?.name ?? "this season"} — scores reconcile with event logs, results are verified, and every team has fixtures.
        </div>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${errors.length > 0 ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-ochre-500/40 bg-ochre-500/10 text-ochre-200"}`}>
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {errors.length} error(s) and {warnings.length} warning(s) found. Errors block trustworthy rankings; warnings reduce confidence.
          </div>
          <div className="mt-4">
            <DarkTable headers={["Severity", "Finding", ""]} caption="Data quality findings">
              {[...errors, ...warnings].map((f, i) => (
                <tr key={`${f.matchId ?? "team"}-${i}`} className="border-t border-white/5">
                  <Td mono className={`text-xs font-bold uppercase ${f.severity === "error" ? "text-red-300" : "text-ochre-300"}`}>{f.severity}</Td>
                  <Td className="text-sm">{f.message}</Td>
                  <Td className="text-right">
                    {f.matchId && (
                      <Link to={`/score/${f.matchId}`} className="text-xs font-semibold text-ochre-400 hover:underline">
                        Open console →
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </DarkTable>
          </div>
        </>
      )}
      {matches && matches.length === 0 && <div className="mt-4"><EmptyState dark title="No matches this season yet" /></div>}
    </AdminPage>
  );
}
