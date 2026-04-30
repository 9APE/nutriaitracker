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
export const METRIC_META: Record<Metric, MetricMeta> = {
  calories:      { key: "calories",      label: "Calories",       unit: "kcal", defaultGoal: 2000, color: "#5BB882" },
  protein:       { key: "protein",       label: "Protein",        unit: "g",    defaultGoal: 120,  color: "#3B82F6" },
  carbs:         { key: "carbs",         label: "Carbs",          unit: "g",    defaultGoal: 250,  color: "#F59E0B" },
  sugar:         { key: "sugar",         label: "Sugar",          unit: "g",    defaultGoal: 50,   color: "#EC4899" },
  fat:           { key: "fat",           label: "Fat",            unit: "g",    defaultGoal: 70,   color: "#A855F7" },
  fiber:         { key: "fiber",         label: "Fiber",          unit: "g",    defaultGoal: 30,   color: "#10B981" },
  sodium:        { key: "sodium",        label: "Sodium",         unit: "mg",   defaultGoal: 2300, color: "#EF4444" },
  potassium:     { key: "potassium",     label: "Potassium",      unit: "mg",   defaultGoal: 3500, color: "#0EA5E9" },
  cholesterol:   { key: "cholesterol",   label: "Cholesterol",    unit: "mg",   defaultGoal: 300,  color: "#F97316" },
  saturated_fat: { key: "saturated_fat", label: "Saturated fat",  unit: "g",    defaultGoal: 20,   color: "#9333EA" },
  iron:          { key: "iron",          label: "Iron",           unit: "mg",   defaultGoal: 18,   color: "#7C3AED" },
  vitamin_c:     { key: "vitamin_c",     label: "Vitamin C",      unit: "mg",   defaultGoal: 90,   color: "#22C55E" },
  vitamin_d:     { key: "vitamin_d",     label: "Vitamin D",      unit: "µg",   defaultGoal: 20,   color: "#FACC15" },
  calcium:       { key: "calcium",       label: "Calcium",        unit: "mg",   defaultGoal: 1000, color: "#06B6D4" },
};

/**
 * Today's totals for any metric. We only track calories/protein/carbs/fat in meals,
 * everything else returns 0 and is shown as "—" in the UI.
 */
export function totalForMetric(metric: Metric, meals: Meal[]): number {
  const today = todayISO();
  const todays = meals.filter((m) => m.date === today);
  switch (metric) {
    case "calories": return todays.reduce((a, m) => a + (m.calories || 0), 0);
    case "protein":  return todays.reduce((a, m) => a + (m.protein || 0), 0);
    case "carbs":    return todays.reduce((a, m) => a + (m.carbs || 0), 0);
    case "fat":      return todays.reduce((a, m) => a + (m.fat || 0), 0);
    default:         return 0;
  }
}

export function goalForMetric(metric: Metric, goals: Goals): number {
  switch (metric) {
    case "calories": return goals.calories;
    case "protein":  return goals.protein;
    case "carbs":    return goals.carbs;
    case "fat":      return goals.fat;
    default:         return METRIC_META[metric].defaultGoal;
  }
}

export function isTracked(metric: Metric): boolean {
  return metric === "calories" || metric === "protein" || metric === "carbs" || metric === "fat";
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
