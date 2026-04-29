import { todayISO } from "./nouri-storage";

const KEY = "streakData";

export interface StreakData {
  count: number;
  lastLogDate: string; // YYYY-MM-DD
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStreak(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastLogDate: "" };
}

export function recordMealLogged(): StreakData {
  const today = todayISO();
  const yest = yesterdayISO();
  const cur = getStreak();
  let next: StreakData;
  if (cur.lastLogDate === today) {
    next = cur;
  } else if (cur.lastLogDate === yest) {
    next = { count: cur.count + 1, lastLogDate: today };
  } else {
    next = { count: 1, lastLogDate: today };
  }
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("streak:updated"));
  return next;
}
