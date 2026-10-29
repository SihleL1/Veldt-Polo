import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { MatchStatus, MatchView } from "@/lib/domain/types";
import { formatClock, periodRemainingMs } from "@/lib/domain/clock";
import { useNow } from "@/lib/hooks/useNow";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, verification }: { status: MatchStatus; verification?: string }) {
  const map: Record<MatchStatus, { label: string; cls: string; live?: boolean }> = {
    live: { label: "Live", cls: "bg-ochre-400 text-forest-950", live: true },
    paused: { label: "Paused", cls: "bg-ochre-100 text-ochre-600" },
    scheduled: { label: "Scheduled", cls: "bg-forest-50 text-forest-600 border border-forest-200" },
    completed: { label: "Full time", cls: "bg-forest-600 text-cream" },
    abandoned: { label: "Abandoned", cls: "bg-red-100 text-red-800" },
    postponed: { label: "Postponed", cls: "bg-cream-deep text-forest-800" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider">
      {s.live && <span className="h-2 w-2 rounded-full bg-ochre-400 animate-pulse-live" aria-hidden />}
      <span className={cn("rounded px-2 py-0.5", s.cls)}>{s.label}</span>
      {status === "completed" && verification === "disputed" && (
        <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">Disputed</span>
      )}
      {status === "completed" && verification === "unverified" && (
        <span className="rounded bg-cream-deep px-2 py-0.5 text-forest-800">Unverified</span>
      )}
    </span>
  );
}

export function formatKickoff(isoDate: string): { date: string; time: string } {
  const d = new Date(isoDate);
  return {
    date: d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }),
    time: d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }),
  };
}

/** Live match card used on the homepage and /live. */
export function LiveMatchCard({ match }: { match: MatchView }) {
  const now = useNow(500);
  const remaining = periodRemainingMs(match, match.clock, now);
  return (
    <Link
      to={`/matches/${match.id}`}
      className="group flex items-center justify-between gap-4 rounded-lg border border-forest-600/15 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-ochre-500">
            <span className="h-2 w-2 rounded-full bg-ochre-400 animate-pulse-live" aria-hidden />
            Live
          </span>
          <span className="text-muted-foreground">{match.round ?? match.tournament_name}</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="truncate text-left font-semibold text-forest-950">{match.home_school.name}</p>
          <p className="font-data text-3xl font-bold text-forest-950">
            {match.home_score}<span className="mx-2 text-forest-300">—</span>{match.away_score}
          </p>
          <p className="truncate text-right font-semibold text-forest-950">{match.away_school.name}</p>
        </div>
        <p className="mt-2 text-center font-data text-xs text-forest-600">
          Q{match.clock.period} · {formatClock(remaining)}
        </p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-forest-300 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Compact table row for fixtures & results. */
export function MatchRow({ match, showCompetition = true, dark = false }: { match: MatchView; showCompetition?: boolean; dark?: boolean }) {
  const kickoff = formatKickoff(match.scheduled_at);
  const isResult = match.status === "completed" || match.status === "live" || match.status === "paused";
  const homeWin = match.home_score > match.away_score;
  const awayWin = match.away_score > match.home_score;
  const border = dark ? "border-white/10" : "border-cream-deep";
  const hover = dark ? "hover:bg-white/5" : "hover:bg-forest-50/60";
  const muted = dark ? "text-cream/55" : "text-muted-foreground";
  const winCls = dark ? "text-cream" : "text-forest-800";
  const otherCls = dark ? "text-cream/65" : "text-forest-950/70";
  return (
    <tr className={cn("last:border-0", border, hover)}>
      <td className={cn("whitespace-nowrap py-2.5 pl-2 pr-3 font-data text-xs", muted)}>{kickoff.date}</td>
      {showCompetition ? null : (
        <td className={cn("hidden whitespace-nowrap py-2.5 pr-3 font-data text-xs sm:table-cell", muted)}>{kickoff.time}</td>
      )}
      <td className={cn("py-2.5 pr-3 text-sm font-medium", isResult && homeWin && winCls, isResult && !homeWin && otherCls, dark && "text-cream")}>
        <Link to={`/schools/${match.home_school.slug}`} className="hover:underline">{match.home_school.name}</Link>
      </td>
      <td className={cn("whitespace-nowrap px-2 py-2.5 text-center font-data text-sm font-bold", dark && "text-cream")}>
        {isResult ? `${match.home_score} – ${match.away_score}` : kickoff.time}
      </td>
      <td className={cn("py-2.5 pr-3 text-sm font-medium", isResult && awayWin && winCls, isResult && !awayWin && otherCls, dark && "text-cream")}>
        <Link to={`/schools/${match.away_school.slug}`} className="hover:underline">{match.away_school.name}</Link>
      </td>
      {showCompetition && <td className={cn("hidden py-2.5 pr-3 text-xs md:table-cell", muted)}>{match.tournament_name}</td>}
      <td className="py-2.5 pr-2 text-right">
        <Link to={`/matches/${match.id}`} className="inline-flex">
          <StatusBadge status={match.status} verification={match.verification} />
        </Link>
      </td>
    </tr>
  );
}
