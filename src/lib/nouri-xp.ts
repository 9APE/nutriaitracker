import { isoDateUTC, todayISO } from "./nouri-storage";
import { userScopedKey } from "@/lib/user-scoped-storage";

const XP_KEY = "totalXP";
const AWARDS_KEY = "xpAwards"; // { [date]: { proteinHit?: true, allMacrosHit?: true, weeklyCheckin?: string, streakMilestones?: number[] } }

function readScopedItem(baseKey: string, userId?: string | null): string | null {
  const key = userScopedKey(baseKey, userId);
  const raw = localStorage.getItem(key);
  if (raw != null) return raw;
  return key !== baseKey ? localStorage.getItem(baseKey) : null;
}

function writeScopedItem(baseKey: string, value: string, userId?: string | null) {
  localStorage.setItem(userScopedKey(baseKey, userId), value);
}

export type XPSourceId =
  | "meal"
  | "protein-goal"
  | "all-macros"
  | "weekly-checkin"
  | "training"
  | "streak-7";

export interface XPSource {
  id: XPSourceId;
  label: string;
  amount: number;
  description: string;
  emoji: string;
}

export const XP_SOURCES: XPSource[] = [
  { id: "meal", label: "Log a meal", amount: 10, description: "Every meal you log.", emoji: "🍽️" },
  { id: "protein-goal", label: "Hit daily protein goal", amount: 25, description: "Reach your protein target for the day.", emoji: "💪" },
  { id: "all-macros", label: "Hit all daily macro goals", amount: 50, description: "Protein, carbs, fat & calories all on target.", emoji: "🎯" },
  { id: "weekly-checkin", label: "Complete weekly check-in", amount: 30, description: "Reflect on your week.", emoji: "🗓️" },
  { id: "training", label: "Log a training session", amount: 20, description: "Log any workout.", emoji: "⚡" },
  { id: "streak-7", label: "7-day streak milestone", amount: 100, description: "Every 7 consecutive days logged.", emoji: "🔥" },
];

export function getTotalXP(userId?: string | null): number {
  try {
    const raw = readScopedItem(XP_KEY, userId);
    if (raw) {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  } catch {}
  return 0;
}

function setTotalXP(n: number, userId?: string | null) {
  writeScopedItem(XP_KEY, String(Math.max(0, n)), userId);
}

interface AwardsState {
  [date: string]: {
    proteinHit?: true;
    allMacrosHit?: true;
    weeklyCheckin?: string; // ISO week key
    trainingLogged?: true;
    streakMilestones?: number[]; // milestones already awarded (e.g. [7, 14])
  };
}

function readAwards(userId?: string | null): AwardsState {
  try {
    const raw = readScopedItem(AWARDS_KEY, userId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function writeAwards(s: AwardsState, userId?: string | null) {
  writeScopedItem(AWARDS_KEY, JSON.stringify(s), userId);
}

function migrateAwardsForToday(awards: AwardsState, userId?: string | null): AwardsState {
  const today = todayISO();
  const utc = isoDateUTC();
  if (utc !== today && awards[today] == null && awards[utc] != null) {
    awards[today] = awards[utc];
    delete awards[utc];
    writeAwards(awards, userId);
  }
  return awards;
}

//  Level math 
// Level 1: 0-99, Level 2: 100-249, Level 3: 250-499, then +300 per level.
const LEVEL_THRESHOLDS = [0, 100, 250, 500]; // start XP for levels 1, 2, 3, 4
const LEVEL_STEP = 300;

export function levelStartXP(level: number): number {
  if (level <= 1) return 0;
  if (level - 1 < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * LEVEL_STEP;
}

export function levelFromXP(xp: number): number {
  let level = 1;
  while (levelStartXP(level + 1) <= xp) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number; // total xp needed to advance from this level start
  xpToNext: number;
  pct: number; // 0-100
}

export function getLevelInfo(xp: number): LevelInfo {
  const level = levelFromXP(xp);
  const start = levelStartXP(level);
  const next = levelStartXP(level + 1);
  const xpForLevel = next - start;
  const xpIntoLevel = xp - start;
  const xpToNext = Math.max(0, next - xp);
  const pct = Math.min(100, Math.max(0, (xpIntoLevel / xpForLevel) * 100));
  return { level, xpIntoLevel, xpForLevel, xpToNext, pct };
}

//  Awarding 
const DAILY_XP_KEY = "xpDailyTotals";

function readDailyXP(userId?: string | null): Record<string, number> {
  try {
    const raw = readScopedItem(DAILY_XP_KEY, userId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function getXPEarnedToday(userId?: string | null): number {
  const map = readDailyXP(userId);
  const today = todayISO();
  const utc = isoDateUTC();
  // Back-compat: older builds keyed daily XP by UTC date.
  if (utc !== today && map[today] == null && map[utc] != null) {
    map[today] = map[utc];
    delete map[utc];
    writeScopedItem(DAILY_XP_KEY, JSON.stringify(map), userId);
  }
  return map[today] ?? 0;
}

function bumpDailyXP(amount: number, userId?: string | null) {
  const map = readDailyXP(userId);
  const today = todayISO();
  const utc = isoDateUTC();
  if (utc !== today && map[today] == null && map[utc] != null) {
    map[today] = map[utc];
    delete map[utc];
  }
  map[today] = (map[today] ?? 0) + amount;
  writeScopedItem(DAILY_XP_KEY, JSON.stringify(map), userId);
}

function emitXPAward(amount: number, source: XPSourceId) {
  window.dispatchEvent(new CustomEvent("xp:awarded", { detail: { amount, source } }));
}

function award(amount: number, source: XPSourceId, userId?: string | null) {
  const next = getTotalXP(userId) + amount;
  setTotalXP(next, userId);
  bumpDailyXP(amount, userId);
  emitXPAward(amount, source);
}

export function awardMealXP(userId?: string | null) {
  award(10, "meal", userId);
}

export function awardTrainingXP(userId?: string | null) {
  award(20, "training", userId);
}

/**
 * Call when today's training state changes. Awards training XP at most once
 * per (local) day.
 */
export function checkTrainingAward(hasTraining: boolean, userId?: string | null) {
  if (!hasTraining) return;
  const today = todayISO();
  const awards = migrateAwardsForToday(readAwards(userId), userId);
  const day = awards[today] ?? {};
  if (day.trainingLogged) return;
  day.trainingLogged = true;
  awards[today] = day;
  writeAwards(awards, userId);
  award(20, "training", userId);
}

export function maybeAwardWeeklyCheckin(userId?: string | null) {
  // weekKey: YYYY-Www
  const d = new Date();
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const weekKey = `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;

  const today = todayISO();
  const awards = migrateAwardsForToday(readAwards(userId), userId);
  const day = awards[today] ?? {};
  if (day.weeklyCheckin === weekKey) return;
  day.weeklyCheckin = weekKey;
  awards[today] = day;
  writeAwards(awards, userId);
  award(30, "weekly-checkin", userId);
}

/**
 * Call after a meal is logged. Awards protein-goal and all-macros XP at most
 * once per day. `totals` is today's running totals after this meal.
 */
export function checkDailyGoalAwards(
  totals: { calories: number; protein: number; carbs: number; fat: number },
  goals: { calories: number; protein: number; carbs: number; fat: number },
  userId?: string | null,
) {
  const today = todayISO();
  const awards = migrateAwardsForToday(readAwards(userId), userId);
  const day = awards[today] ?? {};

  const proteinHit = totals.protein >= goals.protein;
  const allHit =
    proteinHit &&
    totals.calories >= goals.calories &&
    totals.carbs >= goals.carbs &&
    totals.fat >= goals.fat;

  let changed = false;
  if (proteinHit && !day.proteinHit) {
    day.proteinHit = true;
    changed = true;
    award(25, "protein-goal", userId);
  }
  if (allHit && !day.allMacrosHit) {
    day.allMacrosHit = true;
    changed = true;
    award(50, "all-macros", userId);
    window.dispatchEvent(new CustomEvent("goals:all-hit"));
  }
  if (changed) {
    awards[today] = day;
    writeAwards(awards, userId);
  }
}

/**
 * Call whenever the streak count changes. Awards +100 XP for each new
 * 7-day milestone (7, 14, 21, ) at most once each.
 */
export function checkStreakMilestone(streakCount: number, userId?: string | null) {
  if (streakCount < 7) return;
  const today = todayISO();
  const awards = migrateAwardsForToday(readAwards(userId), userId);
  const day = awards[today] ?? {};
  const already = day.streakMilestones ?? [];

  const milestones: number[] = [];
  for (let m = 7; m <= streakCount; m += 7) milestones.push(m);
  const newMilestones = milestones.filter((m) => !already.includes(m));
  if (!newMilestones.length) return;

  day.streakMilestones = [...already, ...newMilestones];
  awards[today] = day;
  writeAwards(awards, userId);
  for (const _ of newMilestones) award(100, "streak-7", userId);
}
