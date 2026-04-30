import { todayISO } from "./nouri-storage";

export type TrainingType =
  | "Strength"
  | "Cardio"
  | "Cycling"
  | "Bouldering"
  | "Other";

export interface TrainingEntry {
  type: TrainingType;
  date: string; // YYYY-MM-DD
}

const KEY = "todayTraining";

export const TRAINING_PROTEIN_BONUS = 20;

export const TRAINING_OPTIONS: { type: TrainingType; emoji: string; label: string }[] = [
  { type: "Strength", emoji: "", label: "Strength training" },
  { type: "Cardio", emoji: "", label: "Cardio" },
  { type: "Cycling", emoji: "", label: "Cycling" },
  { type: "Bouldering", emoji: "", label: "Bouldering" },
  { type: "Other", emoji: "", label: "Other" },
];

export function getTodayTraining(): TrainingEntry | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as TrainingEntry;
    if (t?.date !== todayISO()) {
      // Stale — clear it
      localStorage.removeItem(KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function saveTodayTraining(type: TrainingType): TrainingEntry {
  const entry: TrainingEntry = { type, date: todayISO() };
  localStorage.setItem(KEY, JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent("training:updated"));
  return entry;
}

export function clearTodayTraining() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("training:updated"));
}

export function trainingEmoji(type: TrainingType): string {
  return TRAINING_OPTIONS.find((o) => o.type === type)?.emoji ?? "";
}
