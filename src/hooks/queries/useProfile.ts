/**
 * React Query hooks for the user's profile row. Optimistic updates so
 * EditProfileSheet feels instant.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/lib/nouri-cloud";
import { qk } from "@/lib/query-client";
import { GUEST_PROFILE_ROW, GUEST_SAVE_MESSAGE } from "@/lib/guest-mode";
import { toast } from "sonner";

export function useProfile() {
  const { user, isGuest } = useAuth();
  return useQuery({
    queryKey: qk.profile(user?.id),
    enabled: !!user && !isGuest,
    // Guests never touch the cloud: serve a neutral local profile instead
    initialData: isGuest ? (GUEST_PROFILE_ROW as Profile) : undefined,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (isGuest) throw new Error(GUEST_SAVE_MESSAGE);
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch } as any, { onConflict: "id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      if (!user) return;
      const key = qk.profile(user.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Profile | null>(key);
      qc.setQueryData<Profile | null>(key, (cur) =>
        cur ? ({ ...cur, ...patch } as Profile) : ({ id: user.id, ...patch } as Profile),
      );
      return { previous };
    },
    onError: (err: any, _patch, ctx) => {
      if (!user || !ctx) return;
      qc.setQueryData(qk.profile(user.id), ctx.previous);
      toast.error(err?.message || "Couldn't save profile");
    },
    onSettled: () => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: qk.profile(user.id) });
    },
  });
}
