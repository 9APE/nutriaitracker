/**
 * React Query hooks for goals.
 *
 * The `goals` table now stores both the four base macros AND the full
 * `extended` JSON blob (micronutrient targets + AI reasoning + bodyweight
 * snapshot). Both update through a single `useUpdateGoals` mutation with
 * optimistic UI.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_GOALS, type Goals } from "@/lib/nouri-storage";
import type { ExtendedGoals } from "@/lib/nouri-goals";
import { qk } from "@/lib/query-client";
import { GUEST_SAVE_MESSAGE } from "@/lib/guest-mode";
import { toast } from "sonner";

export interface GoalsRow {
  base: Goals;
  extended: ExtendedGoals;
}

function rowToGoals(row: any | null): GoalsRow {
  const base: Goals = {
    calories: row?.calories ?? DEFAULT_GOALS.calories,
    protein: row?.protein ?? DEFAULT_GOALS.protein,
    carbs: row?.carbs ?? DEFAULT_GOALS.carbs,
    fat: row?.fat ?? DEFAULT_GOALS.fat,
  };
  const extended: ExtendedGoals = {
    ...base,
    ...(row?.extended && typeof row.extended === "object" ? row.extended : {}),
    // base macros from the columns always win over the JSON blob
    calories: base.calories,
    protein: base.protein,
    carbs: base.carbs,
    fat: base.fat,
  };
  return { base, extended };
}

export function useGoals() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: qk.goals(user?.id),
    enabled: !!user && !isGuest,
    initialData: isGuest ? rowToGoals(null) : undefined,
    queryFn: async (): Promise<GoalsRow> => {
      const { data, error } = await supabase
        .from("goals")
        .select("calories, protein, carbs, fat, extended")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return rowToGoals(data);
    },
  });
}

export interface UpdateGoalsInput {
  base: Goals;
  extended?: ExtendedGoals;
}

export function useUpdateGoals() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async ({ base, extended }: UpdateGoalsInput) => {
      if (isGuest) throw new Error(GUEST_SAVE_MESSAGE);
      if (!user) throw new Error("Not signed in");
      const payload: any = {
        user_id: user.id,
        ...base,
      };
      if (extended) payload.extended = extended;
      const { error } = await supabase.from("goals").upsert(payload);
      if (error) throw error;
    },
    onMutate: async ({ base, extended }) => {
      if (!user) return;
      const key = qk.goals(user.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GoalsRow>(key);
      const next: GoalsRow = {
        base,
        extended: { ...(extended ?? previous?.extended ?? base), ...base },
      };
      qc.setQueryData<GoalsRow>(key, next);
      return { previous };
    },
    onError: (err: any, _input, ctx) => {
      if (!user || !ctx) return;
      qc.setQueryData(qk.goals(user.id), ctx.previous);
      toast.error(err?.message || "Couldn't save goals");
    },
    onSettled: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: qk.goals(user.id) });
    },
  });
}
