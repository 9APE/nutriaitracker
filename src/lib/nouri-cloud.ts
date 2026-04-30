import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal, MealType } from "./nouri-storage";

export interface Profile {
  id: string;
  display_name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  user_profile_json: any | null;
  user_warnings_json: any | null;
}

export const cloud = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async updateProfile(userId: string, patch: Partial<Profile>) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (error) throw error;
  },

  async getGoals(userId: string): Promise<Goals | null> {
    const { data, error } = await supabase
      .from("goals")
      .select("calories, protein, carbs, fat")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Goals | null;
  },

  async upsertGoals(userId: string, goals: Goals) {
    const { error } = await supabase
      .from("goals")
      .upsert({ user_id: userId, ...goals });
    if (error) throw error;
  },

  async listMeals(userId: string): Promise<Meal[]> {
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map(rowToMeal);
  },

  async addMeal(userId: string, meal: Omit<Meal, "id" | "created_at">): Promise<Meal> {
    const { data, error } = await supabase
      .from("meals")
      .insert({
        user_id: userId,
        meal_name: meal.meal_name,
        type: meal.type,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        date: meal.date,
        micros: meal.micros ?? null,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return rowToMeal(data);
  },

  async deleteMeal(userId: string, id: string) {
    const { error } = await supabase
      .from("meals")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async bulkInsertMeals(userId: string, meals: Omit<Meal, "id" | "created_at">[]) {
    if (!meals.length) return;
    const rows = meals.map((m) => ({
      user_id: userId,
      meal_name: m.meal_name,
      type: m.type,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      date: m.date,
      micros: m.micros ?? null,
    }));
    const { error } = await supabase.from("meals").insert(rows as any);
    if (error) throw error;
  },
};

function rowToMeal(row: any): Meal {
  return {
    id: row.id,
    meal_name: row.meal_name,
    type: row.type as MealType,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    date: row.date,
    created_at: new Date(row.created_at).getTime(),
    micros: row.micros ?? undefined,
  };
}
