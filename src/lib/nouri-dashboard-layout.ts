import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "./nouri-storage";
import { todayISO } from "./nouri-storage";

export const ALL_METRICS = [
  "calories", "protein", "carbs", "sugar", "fat", "fiber",
  "sodium", "potassium", "cholesterol", "saturated_fat",
  "iron", "vitamin_c", "vitamin_d", "calcium",
] as const;
export type Metric = typeof ALL_METRICS[number];

export interface DashboardLayout {
  large: Metric[];
  medium: Metric[];
  small: Metric[];
  banner: string;
  reasoning: string;
}

const KEY = "dashboardLayout";
const EVENT = "dashboard:layout-updated";

export function getStoredLayout(): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.large)) return null;
    return parsed as DashboardLayout;
  } catch {
    return null;
  }
}

export function saveLayout(layout: DashboardLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function onLayoutChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  large: ["calories", "protein", "carbs"],
  medium: ["fat", "fiber", "sugar"],
  small: ["sodium", "potassium", "cholesterol", "saturated_fat", "iron", "vitamin_c", "vitamin_d", "calcium"],
  banner: "Steady choices today add up to real change.",
  reasoning: "Balanced default until your personalized layout is ready.",
};

export interface MetricMeta {
  key: Metric;
  label: string;
  unit: string;
  /** Estimated per-100g defaults used when a meal doesn't carry the value. Coarse heuristic. */
  defaultGoal: number;
  color: string; // hsl-friendly css var or hex; we keep simple hex tokens
}

// Goal estimates (rough daily reference values for adults; surface only — never used for medical advice).
// Colors use the muted Nouri accent palette: sage / amber / purple / rose / steel-blue.
export const METRIC_META: Record<Metric, MetricMeta> = {
  calories:      { key: "calories",      label: "Calories",       unit: "kcal", defaultGoal: 2000, color: "#5dbd8a" },
  protein:       { key: "protein",       label: "Protein",        unit: "g",    defaultGoal: 120,  color: "#5dbd8a" },
  carbs:         { key: "carbs",         label: "Carbs",          unit: "g",    defaultGoal: 250,  color: "#d4954a" },
  sugar:         { key: "sugar",         label: "Sugar",          unit: "g",    defaultGoal: 50,   color: "#c96b72" },
  fat:           { key: "fat",           label: "Fat",            unit: "g",    defaultGoal: 70,   color: "#9b87d4" },
  fiber:         { key: "fiber",         label: "Fiber",          unit: "g",    defaultGoal: 30,   color: "#5dbd8a" },
  sodium:        { key: "sodium",        label: "Sodium",         unit: "mg",   defaultGoal: 2300, color: "#c96b72" },
  potassium:     { key: "potassium",     label: "Potassium",      unit: "mg",   defaultGoal: 3500, color: "#5b9bd4" },
  cholesterol:   { key: "cholesterol",   label: "Cholesterol",    unit: "mg",   defaultGoal: 300,  color: "#d4954a" },
  saturated_fat: { key: "saturated_fat", label: "Saturated fat",  unit: "g",    defaultGoal: 20,   color: "#9b87d4" },
  iron:          { key: "iron",          label: "Iron",           unit: "mg",   defaultGoal: 18,   color: "#9b87d4" },
  vitamin_c:     { key: "vitamin_c",     label: "Vitamin C",      unit: "mg",   defaultGoal: 90,   color: "#5dbd8a" },
  vitamin_d:     { key: "vitamin_d",     label: "Vitamin D",      unit: "µg",   defaultGoal: 20,   color: "#d4954a" },
  calcium:       { key: "calcium",       label: "Calcium",        unit: "mg",   defaultGoal: 1000, color: "#5b9bd4" },
};

/**
 * Today's totals for any metric. Macros (calories/protein/carbs/fat) are summed
 * directly from each meal; everything else is summed from the optional
 * `meal.micros` object that the AI / food-label flow attaches.
 */
export function totalForMetric(metric: Metric, meals: Meal[]): number {
  const today = todayISO();
  const todays = meals.filter((m) => m.date === today);
  switch (metric) {
    case "calories": return todays.reduce((a, m) => a + (m.calories || 0), 0);
    case "protein":  return todays.reduce((a, m) => a + (m.protein || 0), 0);
    case "carbs":    return todays.reduce((a, m) => a + (m.carbs || 0), 0);
    case "fat":      return todays.reduce((a, m) => a + (m.fat || 0), 0);
    default:
      return todays.reduce(
        (a, m) => a + (Number(m.micros?.[metric as keyof NonNullable<Meal["micros"]>]) || 0),
        0,
      );
  }
}

export function goalForMetric(metric: Metric, goals: Goals): number {
  // Prefer personalised extended goals (from Claude) when available, including
  // training-day adjustments. Falls back to the base macro Goals or generic defaults.
  let ext: any = null;
  try {
    // Lazy-required to avoid circular imports
    const today = localStorage.getItem("todayGoalsDate");
    const isFresh = today ? today === new Date().toISOString().slice(0, 10) : false;
    const raw = isFresh
      ? localStorage.getItem("todayGoals")
      : localStorage.getItem("userGoals");
    if (raw) ext = JSON.parse(raw);
  } catch {}

  switch (metric) {
    case "calories":      return ext?.calories ?? goals.calories;
    case "protein":       return ext?.protein  ?? goals.protein;
    case "carbs":         return ext?.carbs    ?? goals.carbs;
    case "fat":           return ext?.fat      ?? goals.fat;
    case "fiber":         return ext?.fiber             ?? METRIC_META.fiber.defaultGoal;
    case "sugar":         return ext?.sugar_max         ?? METRIC_META.sugar.defaultGoal;
    case "saturated_fat": return ext?.saturated_fat_max ?? METRIC_META.saturated_fat.defaultGoal;
    case "sodium":        return ext?.sodium_max        ?? METRIC_META.sodium.defaultGoal;
    case "cholesterol":   return ext?.cholesterol_max   ?? METRIC_META.cholesterol.defaultGoal;
    case "potassium":     return ext?.potassium         ?? METRIC_META.potassium.defaultGoal;
    case "calcium":       return ext?.calcium           ?? METRIC_META.calcium.defaultGoal;
    case "iron":          return ext?.iron              ?? METRIC_META.iron.defaultGoal;
    case "vitamin_c":     return ext?.vitamin_c         ?? METRIC_META.vitamin_c.defaultGoal;
    case "vitamin_d":     return ext?.vitamin_d         ?? METRIC_META.vitamin_d.defaultGoal;
    default:              return METRIC_META[metric as Metric].defaultGoal;
  }
}

export function isTracked(metric: Metric): boolean {
  // Macros are always tracked; micros are tracked because every AI-logged meal
  // and every barcode/label entry now carries a `micros` object.
  return true;
}

// ── Edge function calls ────────────────────────────────────────────────────

async function langPayload() {
  const i18n = await import("./nouri-i18n");
  return {
    language: i18n.getLanguage() ?? "en",
    languageName: i18n.getLanguageName(),
  };
}

export async function generateLayout(opts: {
  profile: any;
  goals?: Goals;
  currentLayout?: DashboardLayout | null;
  userMessage?: string;
}): Promise<DashboardLayout> {
  const lang = await langPayload();
  const { data, error } = await supabase.functions.invoke("dashboard-layout", {
    body: {
      profile: opts.profile ?? {},
      goals: opts.goals ?? null,
      currentLayout: opts.currentLayout ?? null,
      userMessage: opts.userMessage,
      ...lang,
    },
  });
  if (error) throw new Error(error.message || "Failed to generate layout");
  if (!data?.layout) throw new Error(data?.error || "No layout returned");
  return data.layout as DashboardLayout;
}
