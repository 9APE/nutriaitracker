// Extended personalised daily goals — macros + micros + reasoning.
// Stored locally as JSON; the 4 base macros are also synced to the cloud `goals` table
// via existing cloud.upsertGoals (in nouri-cloud.ts). All extra micros + reasoning live
// only in localStorage as they are derived from Claude per-user.

import type { Goals } from "./nouri-storage";
import { todayISO } from "./nouri-storage";

export interface GoalReasoning {
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  fiber?: string;
  sodium_max?: string;
  sugar_max?: string;
  saturated_fat_max?: string;
  cholesterol_max?: string;
  potassium?: string;
  calcium?: string;
  iron?: string;
  vitamin_c?: string;
  vitamin_d?: string;
  vitamin_a?: string;
}

export interface ExtendedGoals {
  // Macros (mirrored to DB)
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Micros — all daily targets
  fiber?: number;
  sugar_max?: number;
  saturated_fat_max?: number;
  sodium_max?: number;
  cholesterol_max?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_a?: number;
  reasoning?: GoalReasoning;
  /** Snapshot of the profile that produced these goals — useful for training adjustments */
  bodyweight_kg?: number;
  /** ISO date when the user last calibrated */
  calibrated_at?: string;
}

const USER_GOALS_KEY = "userGoals";
const TODAY_GOALS_KEY = "todayGoals";
const TODAY_GOALS_DATE_KEY = "todayGoalsDate";
const EVENT = "goals:updated";

// ── Persistence ────────────────────────────────────────────────────────────
export function loadUserGoals(): ExtendedGoals | null {
  try {
    const raw = localStorage.getItem(USER_GOALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExtendedGoals;
  } catch {
    return null;
  }
}

export function saveUserGoals(g: ExtendedGoals) {
  localStorage.setItem(USER_GOALS_KEY, JSON.stringify(g));
  // Reset today goals so they recompute against the new base
  localStorage.removeItem(TODAY_GOALS_KEY);
  localStorage.removeItem(TODAY_GOALS_DATE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function loadTodayGoals(): ExtendedGoals | null {
  try {
    const date = localStorage.getItem(TODAY_GOALS_DATE_KEY);
    if (date && date !== todayISO()) {
      // Stale — clear so we fall back to base
      localStorage.removeItem(TODAY_GOALS_KEY);
      localStorage.removeItem(TODAY_GOALS_DATE_KEY);
      return null;
    }
    const raw = localStorage.getItem(TODAY_GOALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExtendedGoals;
  } catch {
    return null;
  }
}

export function saveTodayGoals(g: ExtendedGoals) {
  localStorage.setItem(TODAY_GOALS_KEY, JSON.stringify(g));
  localStorage.setItem(TODAY_GOALS_DATE_KEY, todayISO());
  window.dispatchEvent(new Event(EVENT));
}

export function clearTodayGoals() {
  localStorage.removeItem(TODAY_GOALS_KEY);
  localStorage.removeItem(TODAY_GOALS_DATE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function onGoalsChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// ── Effective goals (training-aware) ───────────────────────────────────────
/** Returns todayGoals if present (training day), else base userGoals, else legacy 4-macro Goals. */
export function effectiveGoals(baseGoals: Goals): ExtendedGoals {
  return loadTodayGoals() ?? loadUserGoals() ?? { ...baseGoals };
}

// ── Training-day adjustment ────────────────────────────────────────────────
const INTENSE_TRAINING = new Set(["Strength", "Cardio", "Cycling"]);

/**
 * Compute today's adjusted goals from base goals + a training session.
 * Bodyweight is read from the saved userGoals snapshot; falls back to 70 kg.
 */
export function computeTodayGoals(
  base: ExtendedGoals,
  trainingType: string | null,
): ExtendedGoals {
  if (!trainingType) return { ...base };
  const intense = INTENSE_TRAINING.has(trainingType);
  const bw = base.bodyweight_kg ?? 70;
  const proteinBump = Math.round(0.2 * bw);
  const calorieBump = intense ? 400 : 250;

  return {
    ...base,
    calories: Math.round((base.calories || 0) + calorieBump),
    protein: Math.round((base.protein || 0) + proteinBump),
    potassium: base.potassium != null ? Math.round(base.potassium + 500) : base.potassium,
    sodium_max:
      base.sodium_max != null ? Math.round(base.sodium_max + 300) : base.sodium_max,
    vitamin_c:
      base.vitamin_c != null ? Math.round(base.vitamin_c + 20) : base.vitamin_c,
  };
}

// ── Helpers to extract a body weight from the user profile ─────────────────
/** Parse strings like "78", "78kg", "172 lbs" — returns kilograms or undefined. */
export function parseWeightToKg(weight: string | number | undefined): number | undefined {
  if (typeof weight === "number" && isFinite(weight)) return weight;
  if (!weight || typeof weight !== "string") return undefined;
  const s = weight.toLowerCase().trim();
  const num = parseFloat(s.replace(",", "."));
  if (!isFinite(num)) return undefined;
  if (s.includes("lb") || s.includes("pound")) return Math.round(num * 0.4536);
  return Math.round(num);
}
