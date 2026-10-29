import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeftRight, CloudOff, Flag, Hand, Pause, Play, RotateCcw, Timer, Undo2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, formatKickoff } from "@/components/shared/MatchBits";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { repo } from "@/lib/data";
import type { EventInput } from "@/lib/data/repo";
import { qk, useMatch } from "@/lib/hooks/useData";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ORDER, EVENT_TYPES, eventDef } from "@/lib/domain/events";
import {
  displayElapsedMs,
  formatClock,
  periodRemainingMs,
  resetClock,
  resetShotClock,
  shotClockRemainingMs,
  startClock,
  stopClock,
} from "@/lib/domain/clock";
import type { ClockState, EventCategory, Match, MatchEvent, MatchStatus, MatchView } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const PENDING_KEY = (matchId: string) => `swpza.pending-events.${matchId}`;
const nowMs = () => Date.now();

interface PendingEntry {
  input: EventInput;
  attempts: number;
  queued_at: string;
}

function loadPending(matchId: string): PendingEntry[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY(matchId)) ?? "[]") as PendingEntry[];
  } catch {
    return [];
  }
}
function savePending(matchId: string, list: PendingEntry[]) {
  localStorage.setItem(PENDING_KEY(matchId), JSON.stringify(list));
}

export default function ScoreConsole() {
  const { user, loading: authLoading, hasRole } = useAuth();
  if (authLoading) return <div className="console-dark min-h-screen" />;
  if (!user || !hasRole("scorekeeper", "tournament_admin", "admin")) {
    return <Navigate to="/login" state={{ from: "/score" }} replace />;
  }
  return <Console />;
}

function Console() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: serverMatch, isLoading, error } = useMatch(matchId ?? "");

  // Local authoritative copy: optimistic updates land here first, then the
  // server response (or invalidation) reconciles. A refresh recovers from the
  // persisted clock — nothing lives only in this component.
  const [match, setMatch] = useState<MatchView | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");
  const [cap, setCap] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<MatchEvent | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [feedFilter, setFeedFilter] = useState<EventCategory | "all">("all");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  }, []);

  useEffect(() => {
    if (serverMatch && (!match || match.id !== serverMatch.id || !pendingDirty(serverMatch, match))) {
      setMatch((prev) => (prev && prev.id === serverMatch.id && localNewer(prev, serverMatch) ? prev : serverMatch));
    }
  }, [serverMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matchId) return;
    setPending(loadPending(matchId));
    repo.listEvents(matchId).then(setEvents).catch(() => setEvents([]));
  }, [matchId]);

  const [tick, setTick] = useState(nowMs());
  useEffect(() => {
    if (!match || (match.status !== "live")) return;
    const id = setInterval(() => setTick(nowMs()), 250);
    return () => clearInterval(id);
  }, [match?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushPending = useCallback(async () => {
    if (!matchId || pending.length === 0) return;
    const remaining: PendingEntry[] = [];
    for (const entry of pending) {
      try {
        await repo.recordEvent(entry.input, user?.id ?? "operator");
      } catch {
        remaining.push({ ...entry, attempts: entry.attempts + 1 });
      }
    }
    if (remaining.length !== pending.length) {
      savePending(matchId, remaining);
      setPending(remaining);
      await queryClient.invalidateQueries({ queryKey: qk.match(matchId) });
      const list = await repo.listEvents(matchId).catch(() => []);
      setEvents(list);
      showFlash(`${pending.length - remaining.length} queued action(s) synced.`);
    } else if (remaining.length > 0) {
      // keep trying silently; attempts counter shows operator the struggle
      savePending(matchId, remaining);
    }
  }, [matchId, pending, user?.id, queryClient, showFlash]);

  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(() => void flushPending(), 6000);
    return () => clearInterval(id);
  }, [flushPending, pending.length]);

  if (isLoading) return <div className="console-dark min-h-screen flex items-center justify-center"><LoadingState label="Loading console" /></div>;
  if (error || !match) return <div className="console-dark min-h-screen p-8"><ErrorState message="Match not found." /></div>;

  const clock = match.clock;
  const running = !!clock.running_since;
  const gameRemaining = periodRemainingMs(match, clock, tick);
  const gameElapsed = displayElapsedMs(clock, tick);
  const shotRemaining = shotClockRemainingMs(clock, match.shot_clock_ms, tick);
  const shotRunning = !!clock.shot_running_since;
  const shotExpired = shotRemaining <= 0 && shotRunning;
  const selectedTeamId = selectedTeam === "home" ? match.home_team_id : match.away_team_id;
  const selectedSchool = selectedTeam === "home" ? match.home_school : match.away_school;
  const possessionTeam = match.possession ? (match.possession === "home" ? match.home_school.name : match.away_school.name) : null;

  async function applyClock(next: ClockState, status?: MatchStatus, possession?: MatchView["possession"]) {
    if (!matchId) return;
    setMatch((prev) => (prev ? { ...prev, clock: next, status: status ?? prev.status, possession: possession ?? prev.possession } : prev));
    try {
      const saved = await repo.persistClock(matchId, next, possession ?? match.possession, status ?? match.status);
      setMatch((prev) => (prev && localNewer(prev, saved) ? prev : { ...prev, ...saved }));
    } catch (e) {
      showFlash(`Clock change not saved: ${e instanceof Error ? e.message : "unknown error"}. Retry or keep scoring — state recovers on refresh once the connection returns.`);
    }
    void queryClient.invalidateQueries({ queryKey: qk.match(matchId) });
  }

  async function record(type: string) {
    if (!matchId || !match) return;
    const def = eventDef(type);
    const input: EventInput = {
      id: crypto.randomUUID(),
      match_id: matchId,
      period: clock.period,
      game_clock_ms: gameRemaining,
      team_id: def.defensive ? opponentTeamId(match, selectedTeamId) : selectedTeamId,
      player_id: null,
      player_cap: cap,
      category: def.category,
      event_type: type,
    };
    // Optimistic score for goal events; server reconciles the rest.
    if (def.scores) {
      setMatch((prev) =>
        prev
          ? {
              ...prev,
              home_score: input.team_id === prev.home_team_id ? prev.home_score + 1 : prev.home_score,
              away_score: input.team_id === prev.away_team_id ? prev.away_score + 1 : prev.away_score,
            }
          : prev,
      );
    }
    try {
      const { match: savedMatch } = await repo.recordEvent(input, user?.id ?? "operator");
      setMatch((prev) => (prev && localNewer(prev, savedMatch) ? prev : { ...prev, ...savedMatch }));
      const list = await repo.listEvents(matchId).catch(() => []);
      setEvents(list);
      if (def.scores) {
        // Goal resets the shot clock per competition rules.
        await applyClock(resetShotClock(savedMatch.clock, nowMs(), running), undefined, input.team_id === match.home_team_id ? "home" : "away");
      }
    } catch (e) {
      const entry: PendingEntry = { input, attempts: 1, queued_at: new Date().toISOString() };
      const next = [...pending, entry];
      setPending(next);
      savePending(matchId, next);
      showFlash(`Connection problem — "${def.label}" queued and retrying automatically. (${e instanceof Error ? e.message : "error"})`);
    }
    void queryClient.invalidateQueries({ queryKey: qk.match(matchId) });
  }

  async function startMatch() {
    if (!match) return;
    await applyClock(startClock(resetClock(match.clock, nowMs(), false), nowMs()), "live", "home");
    showFlash("Match started — clock running.");
  }

  async function finalise() {
    if (!matchId || !match) return;
    if (match.status === "completed") return;
    if (!confirm("Finalise this match? The score must reconcile with recorded goal events. Finalised results feed statistics and rankings.")) return;
    setBusy(true);
    try {
      const saved = await repo.finaliseMatch(matchId, { id: user?.id ?? "operator", name: user?.name ?? "Operator" });
      setMatch((prev) => (prev && localNewer(prev, saved) ? prev : { ...prev, ...saved }));
      showFlash("Match finalised. Result is now published to fixtures, results and rankings.");
      void queryClient.invalidateQueries({ queryKey: qk.match(matchId) });
    } catch (e) {
      showFlash(`Cannot finalise: ${e instanceof Error ? e.message : "error"}. Reconcile the score with the event log (undo or correct events) first.`);
    } finally {
      setBusy(false);
    }
  }

  async function doUndo() {
    if (!undoTarget || !matchId) return;
    setBusy(true);
    try {
      await repo.undoEvent(undoTarget.id, undoReason.trim() || "Operator correction", user?.id ?? "operator", user?.name ?? "Operator");
      setUndoTarget(null);
      setUndoReason("");
      const list = await repo.listEvents(matchId).catch(() => []);
      setEvents(list);
      await queryClient.invalidateQueries({ queryKey: qk.match(matchId) });
      const fresh = await repo.getMatch(matchId);
      if (fresh) setMatch((prev) => (prev && localNewer(prev, fresh) ? prev : fresh));
      showFlash("Action undone — score consequences reversed and reason recorded.");
    } catch (e) {
      showFlash(`Undo failed: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<EventCategory, typeof EVENT_TYPES>();
    for (const def of EVENT_TYPES) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return map;
  }, []);

  const feed = events
    .filter((e) => !e.deleted_at)
    .filter((e) => (feedFilter === "all" ? true : e.category === feedFilter))
    .slice()
    .reverse();

  const matchStarted = match.status !== "scheduled";
  const completed = match.status === "completed";

  return (
    <div className="console-dark flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ochre-400">Live scoring console</p>
            <p className="text-sm text-cream/70">{match.tournament_name}</p>
          </div>
          <div className="flex items-center gap-3">
            {pending.length > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full border border-ochre-500/50 bg-ochre-500/10 px-3 py-1 text-xs font-semibold text-ochre-300">
                <CloudOff className="h-3.5 w-3.5" aria-hidden /> {pending.length} queued — retrying
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-cream/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden /> Connected
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream"
              onClick={() => navigate("/score")}
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden /> Exit live scoring
            </Button>
          </div>
        </div>
      </header>

      {flash && (
        <div className="border-b border-ochre-500/40 bg-ochre-500/10 px-4 py-2 text-center text-sm text-ochre-200" role="status">
          {flash}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        {/* Scoreboard */}
        <section aria-label="Scoreboard" className="rounded-xl border border-white/10 bg-black/30 p-5 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-3 sm:justify-start">
              <CapBadge cap={13} home />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-cream sm:text-2xl">{match.home_school.name}</p>
                <p className="text-xs text-cream/50">(home)</p>
              </div>
            </div>
            <div className="text-center">
              <p className="font-data text-5xl font-bold tracking-tight text-cream sm:text-7xl">
                {match.home_score}<span className="mx-2 text-cream/30 sm:mx-4">—</span>{match.away_score}
              </p>
              <p className="mt-2 font-data text-base text-cream/80 sm:text-lg">
                Q{clock.period} · {formatClock(running ? gameRemaining : match.period_length_ms - Math.min(gameElapsed, match.period_length_ms))}
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="rounded border border-ochre-500/50 px-2 py-0.5 font-data text-sm">
                  <span className="text-cream/60">Shot </span>
                  <span className={cn("font-bold", shotExpired ? "text-red-400" : "text-ochre-400")}>
                    {formatClock(shotRemaining)}
                  </span>
                </span>
                {possessionTeam && (
                  <span className="hidden items-center gap-1 text-xs text-cream/70 sm:flex">
                    <span className="h-2 w-2 rounded-full bg-ochre-400" aria-hidden /> Possession: {possessionTeam}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <div className="min-w-0 text-right">
                <p className="truncate text-lg font-bold text-cream sm:text-2xl">{match.away_school.name}</p>
                <p className="text-xs text-cream/50">(away)</p>
              </div>
              <CapBadge cap={7} home={false} />
            </div>
          </div>

          {/* Clock & game controls */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4">
            {!matchStarted ? (
              <ConsoleButton onClick={startMatch} tone="ochre" icon={<Play className="h-4 w-4" aria-hidden />}>Start match</ConsoleButton>
            ) : (
              <>
                <ConsoleButton
                  onClick={() => applyClock(running ? stopClock(clock, nowMs()) : startClock(clock, nowMs()), running ? "paused" : "live")}
                  tone={running ? "neutral" : "green"}
                  icon={running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                >
                  {running ? "Stop clock" : "Start clock"}
                </ConsoleButton>
                <ConsoleButton
                  onClick={() => applyClock(resetShotClock(clock, nowMs(), running))}
                  tone="neutral"
                  icon={<Timer className="h-4 w-4" aria-hidden />}
                >
                  Reset shot clock
                </ConsoleButton>
                <ConsoleButton
                  onClick={() => applyClock({ ...resetClock(clock, nowMs(), running), period: Math.min(clock.period + 1, match.periods) })}
                  tone="neutral"
                  icon={<RotateCcw className="h-4 w-4" aria-hidden />}
                >
                  Next period
                </ConsoleButton>
                <ConsoleButton
                  onClick={() => applyClock(clock, undefined, match.possession === "home" ? "away" : "home")}
                  tone="neutral"
                  icon={<ArrowLeftRight className="h-4 w-4" aria-hidden />}
                >
                  Toggle possession
                </ConsoleButton>
              </>
            )}
            <span className="ml-2 flex items-center gap-2">
              <StatusBadge status={match.status} verification={match.verification} />
              <Link to={`/matches/${match.id}`} className="text-xs text-cream/50 hover:text-cream hover:underline">
                {formatKickoff(match.scheduled_at).date} · public report
              </Link>
            </span>
          </div>
        </section>

        {/* Selector row */}
        <section aria-label="Team and cap selector" className="mt-4 grid gap-3 lg:grid-cols-[2fr_3fr]">
          <div className="grid grid-cols-2 gap-3">
            {(["home", "away"] as const).map((side) => {
              const school = side === "home" ? match.home_school : match.away_school;
              const active = selectedTeam === side;
              return (
                <button
                  key={side}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedTeam(side)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-base font-semibold transition-all",
                    active
                      ? "border-ochre-500 bg-ochre-500/15 text-cream shadow-[0_0_0_1px_theme(colors.ochre.500)]"
                      : "border-white/15 bg-white/5 text-cream/70 hover:bg-white/10",
                  )}
                >
                  {school.name} <span className="text-xs font-normal text-cream/50">({side})</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3">
            <Label className="shrink-0 text-sm text-cream/80">Cap:</Label>
            <span className="font-data w-10 text-center text-2xl font-bold text-ochre-400" aria-live="polite">{cap ?? "—"}</span>
            <div className="grid flex-1 grid-cols-7 gap-1.5">
              {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={cap === n}
                  aria-label={`Cap ${n}${n === 13 ? " (goalkeeper)" : ""}`}
                  onClick={() => setCap(cap === n ? null : n)}
                  className={cn(
                    "rounded border font-data text-sm font-bold transition-colors",
                    cap === n ? "border-ochre-500 bg-ochre-500 text-forest-950" : "border-white/20 bg-black/30 text-cream/80 hover:bg-white/10",
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={cap === null}
                onClick={() => setCap(null)}
                className={cn(
                  "rounded border font-data text-sm font-bold transition-colors",
                  cap === null ? "border-ochre-500 bg-ochre-500 text-forest-950" : "border-white/20 bg-black/30 text-cream/80 hover:bg-white/10",
                )}
              >
                C
              </button>
            </div>
          </div>
        </section>

        {/* Main console area: event buttons left, feed right */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section aria-label="Event buttons" className="space-y-3">
            {!matchStarted && (
              <p className="rounded-lg border border-ochre-500/40 bg-ochre-500/10 px-4 py-2 text-sm text-ochre-200">
                Start the match to enable event tagging.
              </p>
            )}
            {EVENT_CATEGORY_ORDER.filter((c) => c !== "control").map((cat) => (
              <fieldset key={cat} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <legend className="px-1 text-sm font-semibold text-cream">{EVENT_CATEGORY_LABELS[cat]}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(grouped.get(cat) ?? []).map((def) => {
                    const isGoal = !!def.scores;
                    return (
                      <button
                        key={def.type}
                        type="button"
                        disabled={!matchStarted || completed}
                        title={def.description}
                        onClick={() => void record(def.type)}
                        className={cn(
                          "flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
                          isGoal
                            ? "border-ochre-500 bg-ochre-500 text-forest-950 hover:bg-ochre-400"
                            : def.category === "fouls"
                              ? "border-white/20 bg-black/30 text-cream hover:border-red-400/60 hover:bg-red-500/10"
                              : "border-white/20 bg-black/30 text-cream hover:bg-white/10",
                        )}
                      >
                        {isGoal ? "⌾" : def.category === "fouls" ? <Flag className="h-4 w-4 shrink-0" aria-hidden /> : def.category === "shooting" ? <Hand className="h-4 w-4 shrink-0" aria-hidden /> : null}
                        {def.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </section>

          <section aria-label="Recent actions" className="flex flex-col rounded-xl border border-white/10 bg-black/30">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <h2 className="text-lg font-bold text-cream">Recent actions</h2>
              <select
                value={feedFilter}
                onChange={(e) => setFeedFilter(e.target.value as EventCategory | "all")}
                aria-label="Filter feed by category"
                className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-cream"
              >
                <option value="all">All events</option>
                {EVENT_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            {pending.length > 0 && (
              <div className="border-b border-ochre-500/30 bg-ochre-500/5 px-4 py-2 text-xs text-ochre-200">
                {pending.length} action(s) queued offline (oldest first: {eventDef(pending[0].input.event_type).label}). They retry every few seconds and are never lost.
              </div>
            )}
            <div className="max-h-[560px] flex-1 overflow-y-auto">
              {feed.length === 0 && pending.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-cream/50">No actions recorded yet. Tag the first event on the left.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0B1D12]">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-cream/50">
                      <th scope="col" className="px-3 py-2 font-semibold">Time</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Q</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Cap</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Event</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Team</th>
                      <th scope="col" className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pending.slice().reverse().map((p) => (
                      <tr key={p.input.id} className="border-t border-white/5 bg-ochre-500/10 text-cream/80">
                        <td className="px-3 py-1.5 font-data">{formatClock(p.input.game_clock_ms)}</td>
                        <td className="px-2 py-1.5 font-data">Q{p.input.period}</td>
                        <td className="px-2 py-1.5 font-data">{p.input.player_cap ? `#${p.input.player_cap}` : "—"}</td>
                        <td className="px-2 py-1.5">{eventDef(p.input.event_type).label} <span className="text-xs text-ochre-300">· queued</span></td>
                        <td className="px-2 py-1.5 text-cream/60">{teamNameOf(match, p.input.team_id)}</td>
                        <td className="px-2 py-1.5 text-right text-xs text-cream/40">retrying…</td>
                      </tr>
                    ))}
                    {feed.slice(0, 30).map((e) => (
                      <tr key={e.id} className="border-t border-white/5 text-cream/85">
                        <td className="px-3 py-1.5 font-data">{formatClock(e.game_clock_ms)}</td>
                        <td className="px-2 py-1.5 font-data">Q{e.period}</td>
                        <td className="px-2 py-1.5 font-data">{e.player_cap ? `#${e.player_cap}` : "—"}</td>
                        <td className="px-2 py-1.5">
                          <span className={cn(eventDef(e.event_type).scores && "font-semibold text-ochre-300")}>{eventDef(e.event_type).label}</span>
                        </td>
                        <td className="px-2 py-1.5 text-cream/60">{teamNameOf(match, e.team_id)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => setUndoTarget(e)}
                            className="rounded border border-white/20 px-2 py-0.5 text-xs text-cream/80 hover:bg-white/10"
                          >
                            <Undo2 className="mr-1 inline h-3 w-3" aria-hidden />Undo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-white/10 px-4 py-3">
              <Button
                onClick={finalise}
                disabled={busy || completed || !matchStarted}
                className="w-full bg-ochre-500 font-bold text-forest-950 hover:bg-ochre-400"
              >
                {completed ? "Match finalised" : "Finalise match"}
              </Button>
              {completed && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-cream/60">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Finalised — corrections require an administrator via verification review.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-6">
          <p className="font-semibold text-cream">
            {match.home_school.name} {match.home_score} — {match.away_score} {match.away_school.name}
          </p>
          <p className="text-xs text-cream/50">Live scoring · Schools Water Polo South Africa</p>
        </div>
      </footer>

      {/* Undo reason dialog */}
      {undoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Undo action">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-[#0B1D12] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-cream">Undo: {eventDef(undoTarget.event_type).label}</h2>
            <p className="mt-1 text-sm text-cream/60">
              Q{undoTarget.period} · {formatClock(undoTarget.game_clock_ms)} · {teamNameOf(match, undoTarget.team_id)}
              {eventDef(undoTarget.event_type).scores && " — this reverses the goal and corrects the score."}
            </p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="undo-reason" className="text-cream/80">Correction reason (required, recorded in the audit log)</Label>
              <Textarea
                id="undo-reason"
                value={undoReason}
                onChange={(e) => setUndoReason(e.target.value)}
                placeholder="e.g. tagged wrong team; goal was actually #9"
                rows={3}
                className="border-white/20 bg-black/40 text-cream"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream" onClick={() => setUndoTarget(null)}>
                Cancel
              </Button>
              <Button onClick={doUndo} disabled={busy} className="bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400">
                Undo action
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function localNewer(a: MatchView, b: Match): boolean {
  return Date.parse(a.updated_at) > Date.parse(b.updated_at);
}

function pendingDirty(server: Match, local: MatchView): boolean {
  return Date.parse(server.updated_at) > Date.parse(local.updated_at) && !localNewer(local, server);
}

function opponentTeamId(match: MatchView, teamId: string): string {
  return teamId === match.home_team_id ? match.away_team_id : match.home_team_id;
}

function teamNameOf(match: MatchView, teamId: string | null): string {
  if (!teamId) return "—";
  if (teamId === match.home_team_id) return match.home_school.name;
  if (teamId === match.away_team_id) return match.away_school.name;
  return "—";
}

function CapBadge({ cap, home }: { cap: number; home: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-data text-lg font-bold",
        home ? "border-cream/70 bg-white/10 text-cream" : "border-ochre-500 bg-ochre-500/20 text-ochre-300",
      )}
    >
      {cap}
    </span>
  );
}

function ConsoleButton({
  onClick, tone, icon, children,
}: { onClick: () => void; tone: "ochre" | "green" | "neutral"; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-1.5 font-semibold",
        tone === "ochre" && "bg-ochre-500 text-forest-950 hover:bg-ochre-400",
        tone === "green" && "bg-forest-600 text-cream hover:bg-forest-500",
        tone === "neutral" && "border border-white/20 bg-white/5 text-cream hover:bg-white/10",
      )}
    >
      {icon}
      {children}
    </Button>
  );
}
