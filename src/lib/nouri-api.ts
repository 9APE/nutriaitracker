import { supabase } from "@/integrations/supabase/client";
import type { Meal } from "./nouri-storage";

export async function analyzeMeal(text: string): Promise<Omit<Meal, "id" | "created_at">> {
  const { data, error } = await supabase.functions.invoke("analyze-meal", {
    body: { text },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze meal");
  }
  if (!data?.meal) {
    throw new Error(data?.error || "No meal returned");
  }
  return data.meal;
}
