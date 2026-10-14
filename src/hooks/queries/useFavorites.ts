/**
 * React Query hooks for meal favorites.
 *
 * Favorites are user-curated meal snapshots stored in Supabase. Logging from a
 * favorite is a pure copy  NO AI call, NO analysis  for instant 1-tap logging.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Meal, MealMicros, MealType } from "@/lib/nouri-storage";
import { toast } from "sonner";
import { GUEST_SAVE_MESSAGE } from "@/lib/guest-mode";

export interface MealFavorite {
  id: string;
  meal_name: string;
  type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros?: MealMicros;
  last_used_at: string | null;
  created_at: string;
}

const favoritesKey = (uid: string | null | undefined) => ["favorites", uid] as const;

function rowToFavorite(row: any): MealFavorite {
  return {
    id: row.id,
    meal_name: row.meal_name,
    type: row.type as MealType,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    micros: row.micros ?? undefined,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  };
}

export function useFavorites() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: favoritesKey(user?.id),
    enabled: !!user && !isGuest,
    initialData: isGuest ? ([] as MealFavorite[]) : undefined,
    queryFn: async (): Promise<MealFavorite[]> => {
      const { data, error } = await supabase
        .from("meal_favorites")
        .select("*")
        .eq("user_id", user!.id)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(rowToFavorite);
    },
  });
}

/** Snapshot a meal (or arbitrary nutrition payload) into the user's favorites. */
export function useAddFavorite() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<MealFavorite, "id" | "last_used_at" | "created_at">) => {
      if (isGuest) throw new Error(GUEST_SAVE_MESSAGE);
      if (!user) throw new Error("Not signed in");
      // Upsert by (user_id, meal_name, type) so saving twice is a no-op rather
      // than an error.
      const { data, error } = await supabase
        .from("meal_favorites")
        .upsert(
          {
            user_id: user.id,
            meal_name: input.meal_name,
            type: input.type,
            calories: input.calories,
            protein: input.protein,
            carbs: input.carbs,
            fat: input.fat,
            micros: (input.micros ?? null) as any,
          } as any,
          { onConflict: "user_id,meal_name,type" },
        )
        .select()
        .single();
      if (error) throw error;
      return rowToFavorite(data);
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: favoritesKey(user.id) });
      toast.success("Saved to favorites");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save favorite"),
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) throw new Error(GUEST_SAVE_MESSAGE);
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("meal_favorites")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: favoritesKey(user.id) });
    },
  });
}

/** Mark a favorite as just used (bubbles it to the top of the list). */
export function useTouchFavorite() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      await supabase
        .from("meal_favorites")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
    },
    onSuccess: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: favoritesKey(user.id) });
    },
  });
}

/** Convert a favorite into a Meal payload ready for `useAddMeal`. */
export function favoriteToMeal(fav: MealFavorite, date: string): Meal {
  return {
    id: crypto.randomUUID(),
    meal_name: fav.meal_name,
    type: fav.type,
    calories: fav.calories,
    protein: fav.protein,
    carbs: fav.carbs,
    fat: fav.fat,
    date,
    created_at: Date.now(),
    micros: fav.micros,
  };
}
