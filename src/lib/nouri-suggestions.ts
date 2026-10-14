import type { Goals, Meal, MealType } from "./nouri-storage";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./nouri-storage";
import { getFamilyContext } from "@/lib/family-context";
import { dayScopedUserKey, userScopedKey } from "@/lib/user-scoped-storage";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";

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

function notificationPrefix(userId?: string | null): string {
  return `${userScopedKey(NOTIF_KEY, userId)}:`;
}

function notificationKey(userId?: string | null): string {
  return dayScopedUserKey(NOTIF_KEY, todayISO(), userId);
}

function pruneNotificationDays(userId?: string | null) {
  try {
    const prefix = notificationPrefix(userId);
    const todayKey = notificationKey(userId);
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && key !== todayKey) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

export const notifStore = {
  list(userId?: string | null): SuggestionNotification[] {
    pruneNotificationDays(userId);
    try {
      const raw = localStorage.getItem(notificationKey(userId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  },
  save(items: SuggestionNotification[], userId?: string | null) {
    pruneNotificationDays(userId);
    localStorage.setItem(notificationKey(userId), JSON.stringify(items.slice(0, 30)));
  },
  add(n: SuggestionNotification, userId?: string | null) {
    const all = notifStore.list(userId);
    all.unshift(n);
    notifStore.save(all, userId);
  },
  markAllRead(userId?: string | null) {
    notifStore.save(notifStore.list(userId).map((n) => ({ ...n, read: true })), userId);
  },
  remove(id: string, userId?: string | null) {
    notifStore.save(notifStore.list(userId).filter((n) => n.id !== id), userId);
  },
  clear(userId?: string | null) {
    pruneNotificationDays(userId);
    localStorage.removeItem(notificationKey(userId));
    localStorage.removeItem(userScopedKey(LAST_TRIGGER_KEY, userId));
  },
  hydrate(userId?: string | null) {
    pruneNotificationDays(userId);
    return notifStore.list(userId);
  },
};

export const triggerStore = {
  get(userId?: string | null): Record<string, string> {
    try {
      const raw = localStorage.getItem(userScopedKey(LAST_TRIGGER_KEY, userId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  },
  set(map: Record<string, string>, userId?: string | null) {
    localStorage.setItem(userScopedKey(LAST_TRIGGER_KEY, userId), JSON.stringify(map));
  },
  markFired(mealType: MealType, userId?: string | null) {
    const m = triggerStore.get(userId);
    m[mealType] = todayISO();
    triggerStore.set(m, userId);
  },
  hasFiredToday(mealType: MealType, userId?: string | null): boolean {
    return triggerStore.get(userId)[mealType] === todayISO();
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
  mealType: MealType,
  opts?: {
    userId?: string | null;
    profile?: Record<string, any> | null;
  },
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

  const { getLanguage, getLanguageName } = await import("@/lib/nouri-i18n");
  const family = await getFamilyContext(opts?.profile ?? null, opts?.userId);
  const nutritionistContext = buildNutritionistContext({
    meals,
    goals,
    userProfile: opts?.profile ?? null,
  }).aiContext;
  const { data, error } = await supabase.functions.invoke("suggest-meals", {
    body: {
      goals,
      eatenToday,
      mealType,
      profile: opts?.profile ?? null,
      nutritionistContext,
      familyMode: family.familyMode,
      familyRestrictions: family.mergedRestrictions,
      familyMembers: family.memberProfiles,
      language: getLanguage() ?? "en",
      languageName: getLanguageName(),
    },
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
