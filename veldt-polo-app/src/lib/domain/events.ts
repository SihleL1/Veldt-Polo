import type { EventCategory } from "./types";

/**
 * Canonical event catalogue. One physical action maps to exactly one event type:
 * a blocked shot is recorded once (as "block", for the defending team) — never
 * also as a missed shot. The catalogue is data: seeding the event_types table
 * and rendering the console buttons both derive from it.
 */
export interface EventTypeDef {
  type: string;
  label: string;
  category: EventCategory;
  /** Increments the recording team's score. */
  scores?: boolean;
  /** Resets the shot clock when recorded for the team in possession. */
  resets_shot_clock?: boolean;
  /** Recorded for the opponent of the selected team (block, gk_save are defensive). */
  defensive?: boolean;
  description: string;
}

export const EVENT_TYPES: EventTypeDef[] = [
  // Scoring
  { type: "goal", label: "Goal", category: "scoring", scores: true, resets_shot_clock: true, description: "Field goal scored" },
  { type: "penalty_goal", label: "Penalty goal", category: "scoring", scores: true, resets_shot_clock: true, description: "Penalty shot scored" },
  // Shooting
  { type: "shot", label: "Shot", category: "shooting", description: "Shot taken" },
  { type: "shot_on_target", label: "Shot on target", category: "shooting", description: "Shot on target" },
  { type: "missed_shot", label: "Missed shot", category: "shooting", description: "Shot missed" },
  { type: "block", label: "Block", category: "shooting", defensive: true, description: "Field block" },
  { type: "gk_save", label: "Goalkeeper save", category: "shooting", defensive: true, description: "Save by the goalkeeper" },
  // Fouls & exclusions
  { type: "ordinary_foul", label: "Ordinary foul", category: "fouls", description: "Ordinary foul" },
  { type: "exclusion_committed", label: "Exclusion committed", category: "fouls", description: "20-second exclusion, committed" },
  { type: "exclusion_earned", label: "Exclusion earned", category: "fouls", description: "20-second exclusion, earned" },
  { type: "penalty_awarded", label: "Penalty awarded", category: "fouls", description: "Penalty foul awarded" },
  { type: "penalty_missed", label: "Penalty missed", category: "fouls", description: "Penalty shot missed" },
  { type: "yellow_card", label: "Yellow card", category: "fouls", description: "Yellow card" },
  { type: "red_card", label: "Red card", category: "fouls", description: "Red card" },
  { type: "rolling_exclusion", label: "Rolling exclusion", category: "fouls", description: "Rolling substitute exclusion" },
  // Possession & defence
  { type: "steal", label: "Steal", category: "possession", resets_shot_clock: true, description: "Stole possession" },
  { type: "interception", label: "Interception", category: "possession", resets_shot_clock: true, description: "Intercepted a pass" },
  { type: "turnover", label: "Turnover", category: "possession", description: "Lost possession" },
  { type: "possession_started", label: "Possession started", category: "possession", description: "Team took possession" },
  { type: "possession_ended", label: "Possession ended", category: "possession", description: "Team released possession" },
  { type: "corner_throw", label: "Corner throw", category: "possession", resets_shot_clock: true, description: "Corner throw / 20-second situation" },
  // Attack & transition
  { type: "assist", label: "Assist", category: "attack", description: "Final pass before a goal" },
  { type: "sprint_won", label: "Sprint won", category: "attack", description: "Won the sprint" },
  { type: "sprint_lost", label: "Sprint lost", category: "attack", description: "Lost the sprint" },
  { type: "rebound", label: "Rebound", category: "attack", description: "Gained a rebound" },
  { type: "offensive_rebound", label: "Offensive rebound", category: "attack", description: "Rebound in attack" },
  { type: "defensive_rebound", label: "Defensive rebound", category: "attack", description: "Rebound in defence" },
  // Game control
  { type: "timeout", label: "Timeout", category: "control", description: "Team timeout" },
  { type: "period_start", label: "Period start", category: "control", description: "Period started" },
  { type: "period_end", label: "Period end", category: "control", description: "Period ended" },
];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  scoring: "Scoring",
  shooting: "Shooting",
  fouls: "Fouls & Exclusions",
  possession: "Possession & Defence",
  attack: "Attack & Transition",
  control: "Game Control",
};

export const EVENT_CATEGORY_ORDER: EventCategory[] = [
  "scoring",
  "shooting",
  "fouls",
  "possession",
  "attack",
  "control",
];

export const eventDef = (type: string): EventTypeDef =>
  EVENT_TYPES.find((e) => e.type === type) ?? {
    type,
    label: type,
    category: "control",
    description: type,
  };

/** Event types that count as a goal for reconciliation purposes. */
export const GOAL_EVENT_TYPES = EVENT_TYPES.filter((e) => e.scores).map((e) => e.type);
