import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "./nouri-storage";
import type { ExtendedGoals } from "./nouri-goals";
import { todayISO } from "./nouri-storage";
import { userScopedKey } from "@/lib/user-scoped-storage";

export const ALL_METRICS = [
  "calories", "protein", "carbs", "sugar", "fat", "fiber",
  "sodium", "potassium", "cholesterol", "saturated_fat",
  "iron", "vitamin_c", "vitamin_d", "vitamin_a", "calcium",
] as const;
export type Metric = typeof ALL_METRICS[number];

/** Metrics where exceeding the goal is bad (limits, not targets). */
export const LIMIT_METRICS: ReadonlySet<Metric> = new Set([
  "sugar", "sodium", "saturated_fat", "cholesterol",
]);

export interface DashboardLayout {
  large: Metric[];
  medium: Metric[];
  small: Metric[];
  banner: string;
  reasoning: string;
}

const KEY = "dashboardLayout";
const EVENT = "dashboard:layout-updated";

function normalizeLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as DashboardLayout;
  if (!Array.isArray(parsed.large) || !Array.isArray(parsed.medium) || !Array.isArray(parsed.small)) {
    return null;
  }
  const validMetrics = new Set<Metric>(ALL_METRICS);
  const clean = (metrics: unknown) =>
    Array.isArray(metrics)
      ? metrics.filter((metric): metric is Metric => typeof metric === "string" && validMetrics.has(metric as Metric))
      : [];
  return {
    large: clean(parsed.large),
    medium: clean(parsed.medium),
    small: clean(parsed.small),
    banner: typeof parsed.banner === "string" ? parsed.banner : DEFAULT_LAYOUT.banner,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : DEFAULT_LAYOUT.reasoning,
  };
}

export function getStoredLayout(userId?: string | null): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(userScopedKey(KEY, userId));
    if (!raw) return null;
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLayout(layout: DashboardLayout, userId?: string | null) {
  try {
    localStorage.setItem(userScopedKey(KEY, userId), JSON.stringify(layout));
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
  small: ["sodium", "potassium", "cholesterol", "saturated_fat", "iron", "vitamin_c", "vitamin_d", "vitamin_a", "calcium"],
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

// Goal estimates (rough daily reference values for adults; surface only  never used for medical advice).
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
  vitamin_d:     { key: "vitamin_d",     label: "Vitamin D",      unit: "g",   defaultGoal: 20,   color: "#d4954a" },
  vitamin_a:     { key: "vitamin_a",     label: "Vitamin A",      unit: "g",   defaultGoal: 800,  color: "#d4954a" },
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

export function goalForMetric(metric: Metric, goals: Goals | ExtendedGoals): number {
  const g = goals as any;
  switch (metric) {
    case "calories":      return g.calories;
    case "protein":       return g.protein;
    case "carbs":         return g.carbs;
    case "fat":           return g.fat;
    case "fiber":         return g.fiber             ?? METRIC_META.fiber.defaultGoal;
    case "sugar":         return g.sugar_max         ?? METRIC_META.sugar.defaultGoal;
    case "saturated_fat": return g.saturated_fat_max ?? METRIC_META.saturated_fat.defaultGoal;
    case "sodium":        return g.sodium_max        ?? METRIC_META.sodium.defaultGoal;
    case "cholesterol":   return g.cholesterol_max   ?? METRIC_META.cholesterol.defaultGoal;
    case "potassium":     return g.potassium         ?? METRIC_META.potassium.defaultGoal;
    case "calcium":       return g.calcium           ?? METRIC_META.calcium.defaultGoal;
    case "iron":          return g.iron              ?? METRIC_META.iron.defaultGoal;
    case "vitamin_c":     return g.vitamin_c         ?? METRIC_META.vitamin_c.defaultGoal;
    case "vitamin_d":     return g.vitamin_d         ?? METRIC_META.vitamin_d.defaultGoal;
    case "vitamin_a":     return g.vitamin_a         ?? METRIC_META.vitamin_a.defaultGoal;
    default:              return METRIC_META[metric as Metric].defaultGoal;
  }
}

export function isTracked(metric: Metric): boolean {
  // Macros are always tracked; micros are tracked because every AI-logged meal
  // and every barcode/label entry now carries a `micros` object.
  return true;
}

//  Edge function calls 

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
