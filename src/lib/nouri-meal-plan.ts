/** Weekly meal plan localStorage helpers */
import { isoDateLocal } from "@/lib/nouri-storage";
import { userScopedKey } from "@/lib/user-scoped-storage";

export interface PlannedMeal {
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  why?: string;
  prep_time?: string;
  /** Estimated total cook time in minutes (active + passive). */
  cook_time_min?: number;
  ingredients?: string[];
  servings?: number;
  modifications?: string;
  /** When set, the planner produced two variants of the same shared base meal
   * to accommodate mixed diets in the household (e.g. omnivore + vegetarian). */
  variants?: {
    omnivore?: { meal_name: string; protein: number; ingredients?: string[] };
    vegetarian?: { meal_name: string; protein: number; ingredients?: string[] };
    vegan?: { meal_name: string; protein: number; ingredients?: string[] };
  };
}

export interface DayPlan {
  breakfast: PlannedMeal;
  lunch: PlannedMeal;
  dinner: PlannedMeal;
  snack: PlannedMeal;
}

export interface WeeklyPlan {
  weekKey: string; // Monday YYYY-MM-DD
  plan: Record<string, DayPlan>;
  createdAt: string;
  mode: "individual" | "family";
}

const PLANS_KEY = "nouri:weeklyMealPlans";
const MAX_STORED_WEEKS = 4;

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = typeof MEAL_SLOTS[number];

export function getCurrentWeekKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return isoDateLocal(monday);
}

function loadAllPlans(): WeeklyPlan[] {
  try {
    const raw = localStorage.getItem(userScopedKey(PLANS_KEY)) ?? localStorage.getItem(PLANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllPlans(plans: WeeklyPlan[]) {
  // Keep only last MAX_STORED_WEEKS
  const sorted = plans.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  localStorage.setItem(userScopedKey(PLANS_KEY), JSON.stringify(sorted.slice(0, MAX_STORED_WEEKS)));
}

export function getCurrentPlan(): WeeklyPlan | null {
  const key = getCurrentWeekKey();
  return loadAllPlans().find((p) => p.weekKey === key) ?? null;
}

export function savePlan(plan: WeeklyPlan) {
  const all = loadAllPlans().filter((p) => p.weekKey !== plan.weekKey);
  all.push(plan);
  saveAllPlans(all);
}

export function clearCurrentPlan() {
  const key = getCurrentWeekKey();
  saveAllPlans(loadAllPlans().filter((p) => p.weekKey !== key));
}

export function getRecentMealNames(): string[] {
  return loadAllPlans().flatMap((p) =>
    Object.values(p.plan).flatMap((day) =>
      MEAL_SLOTS.map((slot) => (day as any)[slot]?.meal_name).filter(Boolean)
    )
  );
}

export function updateMealInPlan(day: string, slot: MealSlot, meal: PlannedMeal) {
  const plan = getCurrentPlan();
  if (!plan) return;
  if (!plan.plan[day]) return;
  (plan.plan[day] as any)[slot] = meal;
  savePlan(plan);
}

// TODO(family-sync): Migrate weeklyMealPlan to Supabase with real-time sync when Phase 4 is implemented.
