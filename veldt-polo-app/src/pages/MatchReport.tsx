import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { StatusBadge, formatKickoff } from "@/components/shared/MatchBits";
import { ErrorState, LoadingState, ModeBanner } from "@/components/shared/States";
import { eventDef, GOAL_EVENT_TYPES } from "@/lib/domain/events";
import { goalsByPeriod } from "@/lib/domain/stats";
import { formatClock } from "@/lib/domain/clock";
import { repo } from "@/lib/data";
import { useMatch } from "@/lib/hooks/useData";
import type { MatchEvent } from "@/lib/domain/types";

export default function MatchReport() {
  const { id } = useParams<{ id: string }>();
  const { data: match, isLoading } = useMatch(id ?? "");
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    repo
      .listEvents(id)
      .then((list) => {
        if (mounted) setEvents(list);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : "Could not load the event log.");
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (isLoading) return <div className="min-h-screen bg-cream"><SiteHeader /><LoadingState /></div>;
  if (!match) return <div className="min-h-screen bg-cream"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-16"><ErrorState message="Match not found." /></main><SiteFooter /></div>;

  const kickoff = formatKickoff(match.scheduled_at);
  const counted = (events ?? []).filter((e) => !e.deleted_at);
  const goals = goalsByPeriod(match, counted);
  const goalEvents = counted.filter((e) => GOAL_EVENT_TYPES.includes(e.event_type));
  const exclusions = counted.filter((e) => ["exclusion_committed", "exclusion_earned", "yellow_card", "red_card"].includes(e.event_type));
  const eventCoverageComplete = counted.length > 0 && goalEvents.length >= match.home_score + match.away_score;
  const nameOf = (teamId: string) => (teamId === match.home_team_id ? match.home_school.name : teamId === match.away_team_id ? match.away_school.name : "—");

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <Link to="/results" className="text-sm text-forest-600 hover:underline">← All results</Link>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 bg-white">
            <Printer className="h-4 w-4" /> Print report
          </Button>
        </div>

        {error && <div className="mt-4"><ErrorState message={error} /></div>}

        <header className="mt-6 rounded-xl border border-forest-600/15 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{match.tournament_name} · {kickoff.date} · {match.venue || "Venue TBC"}</span>
            <StatusBadge status={match.status} verification={match.verification} />
          </div>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <h1 className="text-right text-xl font-bold text-forest-950 sm:text-2xl">{match.home_school.name}</h1>
            <p className="font-data text-5xl font-bold text-forest-950 sm:text-6xl">
              {match.home_score}<span className="mx-3 text-forest-300">–</span>{match.away_score}
            </p>
            <h1 className="text-xl font-bold text-forest-950 sm:text-2xl">{match.away_school.name}</h1>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {match.round ? `Round ${match.round} · ` : ""}Result verification: {match.verification}.
            {match.status !== "completed" && " This match has not been finalised — the score is provisional."}
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-forest-950">Goals by period</h2>
          {events === null ? (
            <LoadingState label="Loading event log" />
          ) : goalEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No goal events captured for this match, so a period-by-period breakdown is not available.
              The final score above is the confirmed result.
            </p>
          ) : (
            <table className="mt-4 w-full max-w-md text-sm">
              <thead>
                <tr className="border-b-2 border-forest-600/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-1.5 font-semibold">Period</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">{match.home_school.name}</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">{match.away_school.name}</th>
                </tr>
              </thead>
              <tbody className="font-data">
                {goals.map((g) => (
                  <tr key={g.period} className="border-b border-cream-deep last:border-0">
                    <td className="py-1.5">Q{g.period}</td>
                    <td className="py-1.5 text-right">{g.home}</td>
                    <td className="py-1.5 text-right">{g.away}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-forest-600/30 font-bold">
                  <td className="pt-2">Final</td>
                  <td className="pt-2 text-right">{match.home_score}</td>
                  <td className="pt-2 text-right">{match.away_score}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {eventCoverageComplete
              ? "Confirmed: goal events reconcile with the final score."
              : counted.length === 0
                ? "Data completeness: no event log — this is a result-only record."
                : `Data completeness: ${goalEvents.length} of ${match.home_score + match.away_score} goals captured as events. Missing detail is not estimated.`}
          </p>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-forest-950">Discipline &amp; exclusions</h2>
            {exclusions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No exclusion events captured.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {exclusions.slice(0, 12).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 border-b border-cream-deep py-1 last:border-0">
                    <span>
                      <span className="font-data mr-2 text-muted-foreground">Q{e.period} {formatClock(e.game_clock_ms)}</span>
                      {e.player_cap ? `#${e.player_cap} ` : ""}
                      {eventDef(e.event_type).label}
                    </span>
                    <span className="text-xs text-muted-foreground">{nameOf(e.team_id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-forest-950">Match details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Competition" v={match.tournament_name} />
              <Row k="Scheduled" v={`${kickoff.date} ${kickoff.time}`} />
              <Row k="Venue" v={match.venue || "—"} />
              <Row k="Round" v={match.round ?? "—"} />
              <Row k="Format" v={`${match.periods} × ${match.period_length_ms / 60000} min · ${match.shot_clock_ms / 1000}s shot clock`} />
              <Row k="Verification" v={match.verification} />
            </dl>
          </div>
        </section>

        {events !== null && counted.length > 0 && (
          <section className="mt-6 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-forest-950">Key match events</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b-2 border-forest-600/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-1.5 font-semibold">Clock</th>
                  <th scope="col" className="py-1.5 font-semibold">Period</th>
                  <th scope="col" className="py-1.5 font-semibold">Cap</th>
                  <th scope="col" className="py-1.5 font-semibold">Event</th>
                  <th scope="col" className="py-1.5 font-semibold">Team</th>
                </tr>
              </thead>
              <tbody>
                {[...counted].reverse().slice(0, 20).map((e) => (
                  <tr key={e.id} className="border-b border-cream-deep last:border-0">
                    <td className="py-1.5 font-data">{formatClock(e.game_clock_ms)}</td>
                    <td className="py-1.5 font-data">Q{e.period}</td>
                    <td className="py-1.5 font-data">{e.player_cap ? `#${e.player_cap}` : "—"}</td>
                    <td className="py-1.5">{eventDef(e.event_type).label}</td>
                    <td className="py-1.5 text-muted-foreground">{nameOf(e.team_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-cream-deep pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium capitalize text-forest-950">{v}</dd>
    </div>
  );
}
