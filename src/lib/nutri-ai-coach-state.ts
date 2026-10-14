import { todayISO } from "@/lib/nouri-storage";
import type { CoachCheckInWindow, CoachFeedbackReason } from "@/lib/nutri-ai/nutrition-rule-types";
import type { NutritionistFeedbackMemoryEntry } from "@/lib/nutri-ai/nutritionist-checkin-scheduler";
import { dayScopedUserKey, userScopedKey } from "@/lib/user-scoped-storage";

export type CoachMoment = CoachCheckInWindow;
export type CoachTone = "supportive" | "balanced" | "direct" | "motivational" | "scientific";

export interface CoachState {
  coachTone: CoachTone;
  dismissedCheckIns: Partial<Record<CoachMoment, true>>;
  seenCheckIns: Partial<Record<CoachMoment, true>>;
  notHelpfulCheckIns: Partial<Record<CoachMoment, true>>;
  feedbackReasons: Partial<Record<CoachMoment, CoachFeedbackReason>>;
  persistentFeedback: Record<string, NutritionistFeedbackMemoryEntry>;
  lastCheckInTime?: number;
  lastPromptTime?: number;
  seenPrompts: Record<string, true>;
  dismissedPrompts: Record<string, true>;
  answeredPrompts: Record<string, string>;
  lastTopPriority?: string;
  snackRescueShown?: boolean;
  eveningReviewShown?: boolean;
}

const KEY = "nutri-ai:coach-state";
const MEMORY_KEY = "nutri-ai:coach-feedback-memory";
const TONE_KEY = "nutri-ai:coach-tone";
const EVENT = "nutri-ai:coach-state-updated";

function storageKey(userId?: string | null) {
  return dayScopedUserKey(KEY, todayISO(), userId);
}

function memoryKey(userId?: string | null) {
  return userScopedKey(MEMORY_KEY, userId);
}

function toneKey(userId?: string | null) {
  return userScopedKey(TONE_KEY, userId);
}

function memoryEntryKey(nutrientId: string, ruleId?: string) {
  return `${nutrientId}:${ruleId || "any"}`;
}

function emptyState(): CoachState {
  return {
    coachTone: "balanced",
    dismissedCheckIns: {},
    seenCheckIns: {},
    notHelpfulCheckIns: {},
    feedbackReasons: {},
    persistentFeedback: {},
    seenPrompts: {},
    dismissedPrompts: {},
    answeredPrompts: {},
  };
}

export function getCoachTone(userId?: string | null): CoachTone {
  try {
    const raw = localStorage.getItem(toneKey(userId));
    if (
      raw === "supportive" ||
      raw === "balanced" ||
      raw === "direct" ||
      raw === "motivational" ||
      raw === "scientific"
    )
      return raw;
  } catch {}
  return "balanced";
}

export function saveCoachTone(tone: CoachTone, userId?: string | null) {
  try {
    localStorage.setItem(toneKey(userId), tone);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

function getPersistentFeedback(userId?: string | null): Record<string, NutritionistFeedbackMemoryEntry> {
  try {
    const raw = localStorage.getItem(memoryKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, NutritionistFeedbackMemoryEntry>;
    return Object.fromEntries(
      Object.entries(parsed ?? {}).filter(
        ([, entry]) =>
          entry &&
          typeof entry.nutrientId === "string" &&
          (entry.reason === "too_strict" || entry.reason === "too_generic"),
      ),
    );
  } catch {
    return {};
  }
}

function savePersistentFeedback(memory: Record<string, NutritionistFeedbackMemoryEntry>, userId?: string | null) {
  try {
    localStorage.setItem(memoryKey(userId), JSON.stringify(memory));
  } catch {}
}

export function getCoachState(userId?: string | null): CoachState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as CoachState;
    return {
      coachTone: getCoachTone(userId),
      dismissedCheckIns: parsed.dismissedCheckIns ?? {},
      seenCheckIns: parsed.seenCheckIns ?? {},
      notHelpfulCheckIns: parsed.notHelpfulCheckIns ?? {},
      feedbackReasons: parsed.feedbackReasons ?? {},
      persistentFeedback: getPersistentFeedback(userId),
      lastCheckInTime: parsed.lastCheckInTime,
      lastPromptTime: parsed.lastPromptTime,
      seenPrompts: parsed.seenPrompts ?? {},
      dismissedPrompts: parsed.dismissedPrompts ?? {},
      answeredPrompts: parsed.answeredPrompts ?? {},
      lastTopPriority: parsed.lastTopPriority,
      snackRescueShown: parsed.snackRescueShown ?? false,
      eveningReviewShown: parsed.eveningReviewShown ?? false,
    };
  } catch {
    return emptyState();
  }
}

export function saveCoachState(state: CoachState, userId?: string | null) {
  try {
    const { persistentFeedback, coachTone, ...dailyState } = state;
    localStorage.setItem(storageKey(userId), JSON.stringify(dailyState));
    if (persistentFeedback) savePersistentFeedback(persistentFeedback, userId);
    saveCoachTone(coachTone ?? "balanced", userId);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function markCoachSeen(moment: CoachMoment, topPriority?: string, userId?: string | null) {
  const state = getCoachState(userId);
  state.seenCheckIns[moment] = true;
  state.lastCheckInTime = Date.now();
  state.lastTopPriority = topPriority;
  if (moment === "Afternoon snack rescue") state.snackRescueShown = true;
  if (moment === "Evening review") state.eveningReviewShown = true;
  saveCoachState(state, userId);
}

export function markCoachPromptSeen(promptKey: string, userId?: string | null) {
  const state = getCoachState(userId);
  state.seenPrompts[promptKey] = true;
  state.lastPromptTime = Date.now();
  saveCoachState(state, userId);
}

export function dismissCoachPrompt(promptKey: string, userId?: string | null) {
  const state = getCoachState(userId);
  state.dismissedPrompts[promptKey] = true;
  state.lastPromptTime = Date.now();
  saveCoachState(state, userId);
}

export function answerCoachPrompt(promptKey: string, answer: string, userId?: string | null) {
  const state = getCoachState(userId);
  state.answeredPrompts[promptKey] = answer;
  state.lastPromptTime = Date.now();
  saveCoachState(state, userId);
}

export function dismissCoachMoment(moment: CoachMoment, userId?: string | null) {
  const state = getCoachState(userId);
  state.dismissedCheckIns[moment] = true;
  state.lastCheckInTime = Date.now();
  saveCoachState(state, userId);
}

export function markCoachNotHelpful(
  moment: CoachMoment,
  userId?: string | null,
  reason: CoachFeedbackReason = "not_relevant",
  topPriority?: { nutrientId: string; ruleId?: string; audience?: string },
) {
  const state = getCoachState(userId);
  state.notHelpfulCheckIns[moment] = true;
  state.feedbackReasons[moment] = reason;
  state.lastCheckInTime = Date.now();
  if (reason !== "not_relevant" && topPriority?.nutrientId) {
    const key = memoryEntryKey(topPriority.nutrientId, topPriority.ruleId);
    const previous = state.persistentFeedback[key];
    state.persistentFeedback[key] = {
      nutrientId: topPriority.nutrientId,
      ruleId: topPriority.ruleId,
      audience: topPriority.audience,
      reason,
      count: (previous?.count ?? 0) + 1,
      lastAt: Date.now(),
      lastWindow: moment,
    };
  }
  saveCoachState(state, userId);
}

export function restoreCoachMoment(moment: CoachMoment, userId?: string | null) {
  const state = getCoachState(userId);
  delete state.dismissedCheckIns[moment];
  delete state.notHelpfulCheckIns[moment];
  delete state.feedbackReasons[moment];
  saveCoachState(state, userId);
}

export function onCoachStateChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
