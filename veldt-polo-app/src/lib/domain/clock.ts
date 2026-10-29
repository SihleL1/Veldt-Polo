import type { ClockState, Match } from "./types";

/**
 * Clock maths. The authoritative elapsed time is persisted:
 *   elapsed_ms + (running ? now - running_since : 0)
 * The browser interval is only for smooth display — every write persists
 * clock state so a refresh or disconnect recovers exactly.
 */

export const nowMs = (): number => Date.now();

export function displayElapsedMs(clock: ClockState, now: number): number {
  if (clock.running_since) {
    return clock.elapsed_ms + Math.max(0, now - Date.parse(clock.running_since));
  }
  return clock.elapsed_ms;
}

export function periodRemainingMs(match: Pick<Match, "period_length_ms">, clock: ClockState, now: number): number {
  return Math.max(0, match.period_length_ms - displayElapsedMs(clock, now));
}

export function shotClockRemainingMs(clock: ClockState, shotClockMs: number, now: number): number {
  const elapsed =
    clock.shot_elapsed_ms + (clock.shot_running_since ? Math.max(0, now - Date.parse(clock.shot_running_since)) : 0);
  return Math.max(0, shotClockMs - elapsed);
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Start (or resume) the game clock. */
export function startClock(clock: ClockState, now: number, startShot = true): ClockState {
  if (clock.running_since) return clock;
  return {
    ...clock,
    running_since: new Date(now).toISOString(),
    shot_running_since: startShot && !clock.shot_running_since ? new Date(now).toISOString() : clock.shot_running_since,
  };
}

export function stopClock(clock: ClockState, now: number): ClockState {
  if (!clock.running_since) return { ...clock, running_since: null };
  const elapsed = clock.elapsed_ms + Math.max(0, now - Date.parse(clock.running_since));
  const shotElapsed = clock.shot_running_since
    ? clock.shot_elapsed_ms + Math.max(0, now - Date.parse(clock.shot_running_since))
    : clock.shot_elapsed_ms;
  return {
    ...clock,
    elapsed_ms: elapsed,
    running_since: null,
    shot_elapsed_ms: shotElapsed,
    shot_running_since: null,
  };
}

export function resetClock(clock: ClockState, now: number, keepRunning: boolean): ClockState {
  return {
    ...clock,
    elapsed_ms: 0,
    running_since: keepRunning ? new Date(now).toISOString() : null,
    shot_elapsed_ms: 0,
    shot_running_since: null,
  };
}

/** Reset the shot clock (goal, corner throw, etc.). */
export function resetShotClock(clock: ClockState, now: number, keepRunning: boolean): ClockState {
  return {
    ...clock,
    shot_elapsed_ms: 0,
    shot_running_since: keepRunning ? new Date(now).toISOString() : null,
  };
}
