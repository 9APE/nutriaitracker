import type { Goals, Meal } from "./nouri-storage";

// ISO week key like "2026-W18" — Monday is the first day of the week
export function isoWeekKey(d: Date = new Date()): string {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // nearest Thursday
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function isMonday(d: Date = new Date()): boolean {
  return d.getDay() === 1;
}

const LAST_KEY = "lastWeeklyReport";

export function shouldShowWeeklyReport(now: Date = new Date()): boolean {
  if (!isMonday(now)) return false;
  const last = localStorage.getItem(LAST_KEY);
  return last !== isoWeekKey(now);
}

export function markWeeklyReportShown(now: Date = new Date()) {
  localStorage.setItem(LAST_KEY, isoWeekKey(now));
}

function lastNDays(n: number, now: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export interface WeeklyStats {
  totalMeals: number;
  proteinDaysHit: number;
  avgCalories: number;
  streak: number;
  xpThisWeek: number;
}

export function computeWeeklyStats(
  meals: Meal[],
  goals: Goals,
  streak: number,
  now: Date = new Date()
): WeeklyStats {
  const days = lastNDays(7, now);
  const set = new Set(days);
  const weekMeals = meals.filter((m) => set.has(m.date));

  let proteinDaysHit = 0;
  let totalCalories = 0;
  for (const day of days) {
    const dayMeals = weekMeals.filter((m) => m.date === day);
    const dayCals = dayMeals.reduce((s, m) => s + m.calories, 0);
    const dayProtein = dayMeals.reduce((s, m) => s + m.protein, 0);
    totalCalories += dayCals;
    if (dayProtein >= goals.protein) proteinDaysHit++;
  }

  // XP earned in last 7 days from per-day map written by nouri-xp.ts
  let xpThisWeek = 0;
  try {
    const raw = localStorage.getItem("xpDailyTotals");
    if (raw) {
      const map: Record<string, number> = JSON.parse(raw);
      for (const day of days) xpThisWeek += map[day] ?? 0;
    }
  } catch {}

  return {
    totalMeals: weekMeals.length,
    proteinDaysHit,
    avgCalories: Math.round(totalCalories / 7),
    streak,
    xpThisWeek,
  };
}
