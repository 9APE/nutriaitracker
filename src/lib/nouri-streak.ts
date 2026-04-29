import { todayISO } from "./nouri-storage";

const KEY = "streakData";
const FREEZES_KEY = "streakFreezes";
const PENDING_KEY = "streakPendingMessage";

export interface StreakData {
  count: number;
  lastLogDate: string; // YYYY-MM-DD
  // Tracks the count value at which the user last earned a freeze, so we
  // award a new freeze for every additional 7 consecutive days.
  lastFreezeAwardedAt?: number;
}

export type StreakPendingMessage =
  | { kind: "freeze-used"; remainingFreezes: number }
  | { kind: "streak-ended"; previousCount: number };

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  return isoNDaysAgo(1);
}

function diffInDays(a: string, b: string): number {
  // returns (a - b) in whole days, both YYYY-MM-DD
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

export function getStreak(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastLogDate: "", lastFreezeAwardedAt: 0 };
}

function setStreak(s: StreakData) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getFreezes(): number {
  try {
    const raw = localStorage.getItem(FREEZES_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  } catch {}
  return 0;
}

function setFreezes(n: number) {
  localStorage.setItem(FREEZES_KEY, String(Math.max(0, n)));
}

export function consumePendingMessage(): StreakPendingMessage | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as StreakPendingMessage;
  } catch {
    return null;
  }
}

function setPendingMessage(m: StreakPendingMessage) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(m));
}

function maybeAwardFreeze(s: StreakData): StreakData {
  const lastAward = s.lastFreezeAwardedAt ?? 0;
  // Award one freeze every full 7-day milestone past the last award.
  const eligibleMilestones = Math.floor(s.count / 7) - Math.floor(lastAward / 7);
  if (eligibleMilestones > 0) {
    setFreezes(getFreezes() + eligibleMilestones);
    return { ...s, lastFreezeAwardedAt: s.count };
  }
  return s;
}

/**
 * Call once on app start (per session). If the user missed yesterday and has
 * a freeze available, spend one to preserve the streak. Otherwise reset.
 */
export function reconcileStreakOnAppOpen(): void {
  const today = todayISO();
  const cur = getStreak();
  if (!cur.lastLogDate || cur.count === 0) return;
  if (cur.lastLogDate === today) return;

  const gap = diffInDays(today, cur.lastLogDate); // >=1
  if (gap <= 1) return; // logged yesterday — streak still alive, no action needed

  // gap >= 2 → at least one missed day. Each missed day costs one freeze.
  const missed = gap - 1;
  const freezes = getFreezes();

  if (freezes >= missed) {
    // Spend freezes to cover the gap; pretend last log was yesterday so a
    // log today will continue the streak normally.
    setFreezes(freezes - missed);
    setStreak({ ...cur, lastLogDate: yesterdayISO() });
    setPendingMessage({ kind: "freeze-used", remainingFreezes: freezes - missed });
  } else {
    setPendingMessage({ kind: "streak-ended", previousCount: cur.count });
    setStreak({ count: 0, lastLogDate: "", lastFreezeAwardedAt: 0 });
  }
  window.dispatchEvent(new CustomEvent("streak:updated"));
}

export function recordMealLogged(): StreakData {
  const today = todayISO();
  const yest = yesterdayISO();
  const cur = getStreak();
  let next: StreakData;
  if (cur.lastLogDate === today) {
    next = cur;
  } else if (cur.lastLogDate === yest) {
    next = { ...cur, count: cur.count + 1, lastLogDate: today };
  } else {
    next = { count: 1, lastLogDate: today, lastFreezeAwardedAt: 0 };
  }
  next = maybeAwardFreeze(next);
  setStreak(next);
  window.dispatchEvent(new CustomEvent("streak:updated"));
  // Lazy import to avoid cycles
  import("./nouri-xp").then(({ checkStreakMilestone }) => checkStreakMilestone(next.count));
  return next;
}
