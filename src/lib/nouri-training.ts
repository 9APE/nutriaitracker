import { todayISO } from "./nouri-storage";
import { userScopedKey } from "@/lib/user-scoped-storage";

export type TrainingType =
  | "Strength"
  | "Cardio"
  | "Cycling"
  | "Bouldering"
  | "Other";

export interface TrainingEntry {
  type: TrainingType;
  date: string; // YYYY-MM-DD
  calories?: number;
}

const KEY = "todayTraining";

function storageKey(userId?: string | null) {
  return userScopedKey(KEY, userId);
}

export const TRAINING_PROTEIN_BONUS = 20;

export const TRAINING_OPTIONS: { type: TrainingType; emoji: string; label: string }[] = [
  { type: "Strength", emoji: "", label: "Strength training" },
  { type: "Cardio", emoji: "", label: "Cardio" },
  { type: "Cycling", emoji: "", label: "Cycling" },
  { type: "Bouldering", emoji: "", label: "Bouldering" },
  { type: "Other", emoji: "", label: "Other" },
];

export const TRAINING_BURN: Record<TrainingType, number> = {
  Strength: 350,
  Cardio: 450,
  Cycling: 500,
  Bouldering: 400,
  Other: 300,
};

export function getTodayTraining(userId?: string | null): TrainingEntry | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const t = JSON.parse(raw) as TrainingEntry;
    if (t?.date !== todayISO()) {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function saveTodayTraining(
  type: TrainingType,
  calories?: number,
  userId?: string | null,
): TrainingEntry {
  const entry: TrainingEntry = { type, date: todayISO(), calories };
  localStorage.setItem(storageKey(userId), JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent("training:updated"));
  return entry;
}

export function clearTodayTraining(userId?: string | null) {
  localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(new CustomEvent("training:updated"));
}

export function trainingEmoji(type: TrainingType): string {
  return TRAINING_OPTIONS.find((o) => o.type === type)?.emoji ?? "";
}

export function trainingCalories(entry: TrainingEntry | null): number {
  if (!entry) return 0;
  if (typeof entry.calories === "number" && entry.calories > 0) return entry.calories;
  return TRAINING_BURN[entry.type] ?? 300;
}
