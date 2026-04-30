import type { Goals, Meal, MealType } from "./nouri-storage";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./nouri-storage";

export interface MealSuggestion {
  meal_name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SuggestionNotification {
  id: string;
  created_at: number;
  mealType: MealType;
  suggestions: MealSuggestion[];
  read: boolean;
}

const NOTIF_KEY = "nouri:notifications";
const LAST_TRIGGER_KEY = "nouri:lastTrigger"; // map of mealType -> YYYY-MM-DD

export const notifStore = {
  list(): SuggestionNotification[] {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  },
  save(items: SuggestionNotification[]) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(items.slice(0, 30)));
  },
  add(n: SuggestionNotification) {
    const all = notifStore.list();
    all.unshift(n);
    notifStore.save(all);
  },
  markAllRead() {
    notifStore.save(notifStore.list().map((n) => ({ ...n, read: true })));
  },
  remove(id: string) {
    notifStore.save(notifStore.list().filter((n) => n.id !== id));
  },
  clear() {
    localStorage.removeItem(NOTIF_KEY);
    localStorage.removeItem(LAST_TRIGGER_KEY);
  },
};

export const triggerStore = {
  get(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LAST_TRIGGER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  },
  set(map: Record<string, string>) {
    localStorage.setItem(LAST_TRIGGER_KEY, JSON.stringify(map));
  },
  markFired(mealType: MealType) {
    const m = triggerStore.get();
    m[mealType] = todayISO();
    triggerStore.set(m);
  },
  hasFiredToday(mealType: MealType): boolean {
    return triggerStore.get()[mealType] === todayISO();
  },
};

// Suggested meal-time windows (24h). If current time is inside the window
// and we haven't suggested for that meal today, auto-fire.
export const MEAL_WINDOWS: Array<{ type: MealType; startHour: number; endHour: number }> = [
  { type: "Breakfast", startHour: 7, endHour: 10 },
  { type: "Lunch", startHour: 11, endHour: 14 },
  { type: "Dinner", startHour: 17, endHour: 20 },
];

export function currentMealWindow(now = new Date()): MealType | null {
  const h = now.getHours();
  const w = MEAL_WINDOWS.find((w) => h >= w.startHour && h < w.endHour);
  return w?.type ?? null;
}

export async function fetchSuggestions(
  goals: Goals,
  meals: Meal[],
  mealType: MealType
): Promise<MealSuggestion[]> {
  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);
  const eatenToday = todayMeals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
      names: [...a.names, m.meal_name],
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, names: [] as string[] }
  );

  const { getLanguage } = await import("@/lib/nouri-i18n");
  const { data, error } = await supabase.functions.invoke("suggest-meals", {
    body: { goals, eatenToday, mealType, language: getLanguage() ?? "en" },
  });
  if (error) throw new Error(error.message || "Failed to suggest meals");
  if (!data?.suggestions) throw new Error(data?.error || "No suggestions returned");
  return data.suggestions as MealSuggestion[];
}

// Best-effort browser notification
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export function fireBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "nouri-suggestion" });
  } catch {}
}
