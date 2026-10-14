// Extended personalised daily goals  macros + micros + reasoning.
// Types + pure helpers only. Persistence is now handled by Supabase via
// `useGoals` / `useUpdateGoals` (see src/hooks/queries/useGoals.ts).
// Training-day adjustments are computed on the fly from base goals + the
// current `nouri-training` entry  no longer mirrored to a separate cache.

import type { Goals } from "./nouri-storage";

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
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  /** Snapshot of the profile that produced these goals  useful for training adjustments */
  bodyweight_kg?: number;
  /** ISO date when the user last calibrated */
  calibrated_at?: string;
}

//  Training-day adjustment 
const INTENSE_TRAINING = new Set(["Strength", "Cardio", "Cycling"]);

/**
 * Compute today's adjusted goals from base goals + a training session.
 * Pure function  no storage. Bodyweight comes from the saved
 * `bodyweight_kg` on ExtendedGoals; falls back to 70 kg.
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

//  Helpers 
/** Parse strings like "78", "78kg", "172 lbs"  returns kilograms or undefined. */
export function parseWeightToKg(weight: string | number | undefined): number | undefined {
  if (typeof weight === "number" && isFinite(weight)) return weight;
  if (!weight || typeof weight !== "string") return undefined;
  const s = weight.toLowerCase().trim();
  const num = parseFloat(s.replace(",", "."));
  if (!isFinite(num)) return undefined;
  if (s.includes("lb") || s.includes("pound")) return Math.round(num * 0.4536);
  return Math.round(num);
}

/** Build an ExtendedGoals from a base Goals plus an optional plan blob from the AI. */
export function buildExtendedGoals(
  base: Goals,
  plan: any,
  bodyweightKg: number | undefined,
): ExtendedGoals {
  return {
    calories: base.calories,
    protein: base.protein,
    carbs: base.carbs,
    fat: base.fat,
    fiber: plan?.fiber,
    sugar_max: plan?.sugar_max,
    saturated_fat_max: plan?.saturated_fat_max,
    sodium_max: plan?.sodium_max,
    cholesterol_max: plan?.cholesterol_max,
    potassium: plan?.potassium,
    calcium: plan?.calcium,
    iron: plan?.iron,
    vitamin_c: plan?.vitamin_c,
    vitamin_d: plan?.vitamin_d,
    vitamin_a: plan?.vitamin_a,
    reasoning:
      plan?.reasoning && typeof plan.reasoning === "object"
        ? plan.reasoning
        : plan?.reasoning
        ? { calories: String(plan.reasoning) }
        : undefined,
    bodyweight_kg: bodyweightKg,
    calibrated_at: new Date().toISOString(),
  };
}
