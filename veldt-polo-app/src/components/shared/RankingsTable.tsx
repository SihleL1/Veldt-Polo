import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Eligibility, RankingRow } from "@/lib/domain/types";
import { eligibilityLabel } from "@/lib/domain/rankings";
import { cn } from "@/lib/utils";

export function EligibilityBadge({ e }: { e: Eligibility }) {
  const cls =
    e === "eligible"
      ? "bg-forest-600 text-cream"
      : e === "provisional"
        ? "bg-ochre-400 text-forest-950"
        : e === "under_review"
          ? "bg-cream-deep text-forest-800"
          : "bg-cream-deep text-muted-foreground";
  return <span className={cn("rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider", cls)}>{eligibilityLabel(e)}</span>;
}

export function Movement({ delta }: { delta: number | undefined }) {
  if (delta === undefined || delta === 0)
    return <Minus className="h-3.5 w-3.5 text-forest-300" aria-label="No movement" />;
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-forest-400" aria-label={`Up ${delta}`}>
        <ArrowUp className="h-3.5 w-3.5" />{delta}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-700" aria-label={`Down ${-delta}`}>
      <ArrowDown className="h-3.5 w-3.5" />{-delta}
    </span>
  );
}

export function RankingsTable({
  rows, teamNames, movement,
}: {
  rows: RankingRow[];
  teamNames: Map<string, { name: string; teamId: string }>;
  movement?: Map<string, number>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">National team rankings</caption>
        <thead>
          <tr className="border-b-2 border-forest-600/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-2 pr-2 font-semibold">#</th>
            <th scope="col" className="py-2 pr-2 font-semibold" aria-label="Movement">Δ</th>
            <th scope="col" className="py-2 pr-2 font-semibold">School</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Played</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">W – D – L</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Goals For</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Goals Against</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Diff</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Score</th>
            <th scope="col" className="py-2 pr-2 font-semibold">Eligibility</th>
          </tr>
        </thead>
        <tbody className="font-data">
          {rows.map((r) => {
            const info = teamNames.get(r.team_id);
            return (
              <tr key={r.team_id} className="border-b border-cream-deep last:border-0 hover:bg-forest-50/60">
                <td className="py-2.5 pr-2 font-bold">{r.rank}</td>
                <td className="py-2.5 pr-2">{movement ? <Movement delta={movement.get(r.team_id)} /> : null}</td>
                <td className="py-2.5 pr-2 font-sans font-medium">
                  {info ? (
                    <Link to={`/teams/${info.teamId}`} className="hover:underline">{info.name}</Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-2 text-right">{r.games_played}</td>
                <td className="py-2.5 pr-2 text-right">{r.wins} – {r.draws} – {r.losses}</td>
                <td className="py-2.5 pr-2 text-right">{r.goals_for}</td>
                <td className="py-2.5 pr-2 text-right">{r.goals_against}</td>
                <td className="py-2.5 pr-2 text-right">{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</td>
                <td className="py-2.5 pr-2 text-right font-semibold">{r.score.toFixed(3)}</td>
                <td className="py-2.5 pr-2 font-sans">
                  <EligibilityBadge e={r.eligibility} />
                  {r.eligibility === "provisional" && (
                    <span className="ml-2 text-xs text-muted-foreground">— {r.games_played} games</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
