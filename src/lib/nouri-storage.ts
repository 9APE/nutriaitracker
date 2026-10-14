export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

/** Optional per-meal micronutrient estimates (in their canonical units 
 * grams for fiber/sugar/saturated_fat, mg for sodium/potassium/cholesterol/iron/calcium/vitamin_c,
 * g for vitamin_d). Always best-effort estimates from the AI or food label. */
export interface MealMicros {
  fiber?: number;
  sugar?: number;
  sodium?: number;
  potassium?: number;
  cholesterol?: number;
  saturated_fat?: number;
  iron?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_a?: number;
  calcium?: number;
}

export interface Meal {
  id: string;
  meal_name: string;
  type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
  created_at: number;
  micros?: MealMicros;
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type WaterQuickAmount = "sip" | "glass" | "bottle";

export const WATER_AMOUNTS_ML: Record<WaterQuickAmount, number> = {
  sip: 50,
  glass: 250,
  bottle: 500,
};

export const DEFAULT_GOALS: Goals = {
  calories: 2500,
  protein: 150,
  carbs: 200,
  fat: 70,
};

const KEYS = {
  goals: "nouri:goals",
  meals: "nouri:meals",
  onboarded: "nouri:onboarded",
  water: "nouri:water",
};

function userKey(base: string, userId?: string | null) {
  return userId ? `${base}:${userId}` : base;
}

function getWaterMap(userId?: string | null): Record<string, number> {
  try {
    const raw = localStorage.getItem(userKey(KEYS.water, userId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function setWaterMap(map: Record<string, number>, userId?: string | null) {
  localStorage.setItem(userKey(KEYS.water, userId), JSON.stringify(map));
}

export const storage = {
  getGoals(): Goals {
    try {
      const raw = localStorage.getItem(KEYS.goals);
      if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_GOALS;
  },
  setGoals(g: Goals) {
    localStorage.setItem(KEYS.goals, JSON.stringify(g));
  },
  getMeals(): Meal[] {
    try {
      const raw = localStorage.getItem(KEYS.meals);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  },
  setMeals(meals: Meal[]) {
    localStorage.setItem(KEYS.meals, JSON.stringify(meals));
  },
  addMeal(m: Meal) {
    const all = storage.getMeals();
    all.unshift(m);
    storage.setMeals(all);
  },
  removeMeal(id: string) {
    storage.setMeals(storage.getMeals().filter((m) => m.id !== id));
  },
  isOnboarded(): boolean {
    return localStorage.getItem(KEYS.onboarded) === "true";
  },
  setOnboarded(v: boolean) {
    localStorage.setItem(KEYS.onboarded, v ? "true" : "false");
  },
  reset() {
    localStorage.removeItem(KEYS.goals);
    localStorage.removeItem(KEYS.meals);
    localStorage.removeItem(KEYS.onboarded);
    localStorage.removeItem(KEYS.water);
  },
};

export function getWaterIntakeForDate(date: string, userId?: string | null): number {
  return Math.max(0, Number(getWaterMap(userId)[date] ?? 0));
}

export function addWaterIntakeForDate(date: string, amountMl: number, userId?: string | null): number {
  const map = getWaterMap(userId);
  const next = Math.max(0, Number(map[date] ?? 0) + amountMl);
  map[date] = next;
  setWaterMap(map, userId);
  window.dispatchEvent(new CustomEvent("water:updated", { detail: { date, amountMl: next } }));
  return next;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDateLocal(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoDateUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// NOTE: previously this was UTC via toISOString(). That caused streak/XP to
// roll over at UTC midnight rather than the user's local midnight.
export const todayISO = () => isoDateLocal(new Date());

export const mealTypeEmoji = (t: MealType) =>
  ({ Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙", Snack: "🍎" }[t]);
