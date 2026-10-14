/**
 * React Query hooks for meals. Supabase is the single source of truth.
 *
 * Mutations are optimistic: the UI updates instantly, and we roll back on
 * error. After settle we invalidate so the cache reflects authoritative
 * server state (timestamps, server-generated IDs, etc.).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Meal, MealType } from "@/lib/nouri-storage";
import { qk } from "@/lib/query-client";
import { GUEST_USER_ID } from "@/lib/guest-mode";
import { toast } from "sonner";

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

/** Guests keep meals in memory only: build the row locally instead of inserting it. */
function localMeal(input: NewMealInput): Meal {
  return {
    id: input.id ?? `guest-${crypto.randomUUID()}`,
    meal_name: input.meal_name,
    type: input.type,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    date: input.date,
    created_at: Date.now(),
    micros: input.micros,
  };
}

export function useMeals() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: qk.meals(user?.id),
    enabled: !!user && !isGuest,
    initialData: isGuest ? ([] as Meal[]) : undefined,
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(rowToMeal);
    },
  });
}

export type NewMealInput = Omit<Meal, "id" | "created_at"> & {
  /** Optional client-generated id used for optimistic insert. Will be replaced by the server id. */
  id?: string;
};

export function useAddMeal() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (input: NewMealInput): Promise<Meal> => {
      if (isGuest) return localMeal(input);
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("meals")
        .insert({
          user_id: user.id,
          meal_name: input.meal_name,
          type: input.type,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          date: input.date,
          micros: (input.micros ?? null) as any,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const saved = rowToMeal(data);
      // Preserve AI-estimated micros if the DB round-trip dropped them.
      saved.micros = saved.micros ?? input.micros;
      return saved;
    },
    onMutate: async (input) => {
      if (!user) return;
      const key = qk.meals(user.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Meal[]>(key) ?? [];
      const tempId = input.id ?? `optimistic-${crypto.randomUUID()}`;
      const optimistic: Meal = {
        id: tempId,
        meal_name: input.meal_name,
        type: input.type,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        date: input.date,
        created_at: Date.now(),
        micros: input.micros,
      };
      qc.setQueryData<Meal[]>(key, [optimistic, ...previous]);
      return { previous, tempId };
    },
    onError: (err: any, _input, ctx) => {
      if (!user || !ctx) return;
      // Remove only this meal's optimistic row. Restoring the whole snapshot
      // would also wipe other meals added while this request was in flight.
      qc.setQueryData<Meal[]>(qk.meals(user.id), (cur) => (cur ?? []).filter((m) => m.id !== ctx.tempId));
      toast.error(err?.message || "Couldn't save meal");
    },
    onSuccess: (saved, _input, ctx) => {
      if (!user || !ctx) return;
      // Replace the optimistic row with the server row (preserving order).
      qc.setQueryData<Meal[]>(qk.meals(user.id), (cur) =>
        (cur ?? []).map((m) => (m.id === ctx.tempId ? saved : m)),
      );
    },
    onSettled: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: qk.meals(user.id) });
    },
  });
}

/** Insert several meals in one request (e.g. loading multiple past meals at once). */
export function useAddMeals() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (inputs: NewMealInput[]): Promise<Meal[]> => {
      if (isGuest) return inputs.map(localMeal);
      if (!user) throw new Error("Not signed in");
      if (inputs.length === 0) return [];
      const { data, error } = await supabase
        .from("meals")
        .insert(
          inputs.map((input) => ({
            user_id: user.id,
            meal_name: input.meal_name,
            type: input.type,
            calories: input.calories,
            protein: input.protein,
            carbs: input.carbs,
            fat: input.fat,
            date: input.date,
            micros: (input.micros ?? null) as any,
          })) as any,
        )
        .select();
      if (error) throw error;
      return (data ?? []).map(rowToMeal);
    },
    onSuccess: (saved) => {
      if (!user) return;
      if (isGuest) {
        qc.setQueryData<Meal[]>(qk.meals(user.id), (cur) => [...saved, ...(cur ?? [])]);
        return;
      }
      qc.invalidateQueries({ queryKey: qk.meals(user.id) });
    },
    onError: (err: any) => toast.error(err?.message || "Couldn't save meals"),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) return;
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      if (!user) return;
      const key = qk.meals(user.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Meal[]>(key) ?? [];
      qc.setQueryData<Meal[]>(key, previous.filter((m) => m.id !== id));
      return { previous };
    },
    onError: (err: any, _id, ctx) => {
      if (!user || !ctx) return;
      qc.setQueryData(qk.meals(user.id), ctx.previous);
      toast.error(err?.message || "Couldn't delete meal");
    },
    onSettled: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: qk.meals(user.id) });
    },
  });
}
