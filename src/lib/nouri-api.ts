import { supabase } from "@/integrations/supabase/client";
import { storage, todayISO, type Meal } from "./nouri-storage";

function readUserProfile(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("userProfile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildEatenToday() {
  const today = todayISO();
  const meals = storage.getMeals().filter((m) => m.date === today);
  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + (m.calories || 0),
      protein: a.protein + (m.protein || 0),
      carbs: a.carbs + (m.carbs || 0),
      fat: a.fat + (m.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    totals,
    meals: meals.map((m) => ({
      meal_name: m.meal_name,
      type: m.type,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    })),
  };
}

function readUserWarnings(): string[] {
  try {
    const raw = localStorage.getItem("userWarnings");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export async function analyzeMeal(
  text: string
): Promise<Omit<Meal, "id" | "created_at"> & { tip?: string }> {
  const profile = readUserProfile();
  const goals = storage.getGoals();
  const eatenToday = buildEatenToday();
  const warnings = readUserWarnings();

  const { data, error } = await supabase.functions.invoke("analyze-meal", {
    body: { text, profile, goals, eatenToday, warnings },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze meal");
  }
  if (!data?.meal) {
    throw new Error(data?.error || "No meal returned");
  }
  return data.meal;
}
