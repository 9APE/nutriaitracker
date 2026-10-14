import { isoDateLocal, isoDateUTC, todayISO } from "./nouri-storage";
import { userScopedKey } from "@/lib/user-scoped-storage";

const KEY = "streakData";
const FREEZES_KEY = "streakFreezes";
const PENDING_KEY = "streakPendingMessage";

function readScopedItem(baseKey: string, userId?: string | null): string | null {
  const key = userScopedKey(baseKey, userId);
  const raw = localStorage.getItem(key);
  if (raw != null) return raw;
  return key !== baseKey ? localStorage.getItem(baseKey) : null;
}

function writeScopedItem(baseKey: string, value: string, userId?: string | null) {
  localStorage.setItem(userScopedKey(baseKey, userId), value);
}

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
  return isoDateLocal(d);
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

export function getStreak(userId?: string | null): StreakData {
  try {
    const raw = readScopedItem(KEY, userId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastLogDate: "", lastFreezeAwardedAt: 0 };
}

function setStreak(s: StreakData, userId?: string | null) {
  writeScopedItem(KEY, JSON.stringify(s), userId);
}

export function getFreezes(userId?: string | null): number {
  try {
    const raw = readScopedItem(FREEZES_KEY, userId);
    if (raw) {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  } catch {}
  return 0;
}

function setFreezes(n: number, userId?: string | null) {
  writeScopedItem(FREEZES_KEY, String(Math.max(0, n)), userId);
}

export function consumePendingMessage(userId?: string | null): StreakPendingMessage | null {
  try {
    const key = userScopedKey(PENDING_KEY, userId);
    const raw = readScopedItem(PENDING_KEY, userId);
    if (!raw) return null;
    localStorage.removeItem(key);
    if (userId) localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as StreakPendingMessage;
  } catch {
    return null;
  }
}

function setPendingMessage(m: StreakPendingMessage, userId?: string | null) {
  writeScopedItem(PENDING_KEY, JSON.stringify(m), userId);
}

function maybeAwardFreeze(s: StreakData, userId?: string | null): StreakData {
  const lastAward = s.lastFreezeAwardedAt ?? 0;
  // Award one freeze every full 7-day milestone past the last award.
  const eligibleMilestones = Math.floor(s.count / 7) - Math.floor(lastAward / 7);
  if (eligibleMilestones > 0) {
    setFreezes(getFreezes(userId) + eligibleMilestones, userId);
    return { ...s, lastFreezeAwardedAt: s.count };
  }
  return s;
}

/**
 * Call once on app start (per session). If the user missed yesterday and has
 * a freeze available, spend one to preserve the streak. Otherwise reset.
 */
export function reconcileStreakOnAppOpen(userId?: string | null): void {
  const today = todayISO();
  const todayUTC = isoDateUTC();
  const cur = getStreak(userId);
  if (!cur.lastLogDate || cur.count === 0) return;
  // Back-compat: older builds stored dates as UTC. If that matches todayUTC,
  // treat it as logged today to avoid false "missed day" behavior.
  if (cur.lastLogDate === today || cur.lastLogDate === todayUTC) return;

  const gap = diffInDays(today, cur.lastLogDate); // >=1
  if (gap <= 1) return; // logged yesterday  streak still alive, no action needed

  // gap >= 2  at least one missed day. Each missed day costs one freeze.
  const missed = gap - 1;
  const freezes = getFreezes(userId);

  if (freezes >= missed) {
    // Spend freezes to cover the gap; pretend last log was yesterday so a
    // log today will continue the streak normally.
    setFreezes(freezes - missed, userId);
    setStreak({ ...cur, lastLogDate: yesterdayISO() }, userId);
    setPendingMessage({ kind: "freeze-used", remainingFreezes: freezes - missed }, userId);
  } else {
    setPendingMessage({ kind: "streak-ended", previousCount: cur.count }, userId);
    setStreak({ count: 0, lastLogDate: "", lastFreezeAwardedAt: 0 }, userId);
  }
  window.dispatchEvent(new CustomEvent("streak:updated"));
}

export function recordMealLogged(userId?: string | null): StreakData {
  const today = todayISO();
  const yest = yesterdayISO();
  const cur = getStreak(userId);
  let next: StreakData;
  if (cur.lastLogDate === today) {
    next = cur;
  } else if (cur.lastLogDate === yest) {
    next = { ...cur, count: cur.count + 1, lastLogDate: today };
  } else {
    next = { count: 1, lastLogDate: today, lastFreezeAwardedAt: 0 };
  }
  next = maybeAwardFreeze(next, userId);
  setStreak(next, userId);
  window.dispatchEvent(new CustomEvent("streak:updated"));
  // Lazy import to avoid cycles
  import("./nouri-xp").then(({ checkStreakMilestone }) => checkStreakMilestone(next.count, userId));
  return next;
}
