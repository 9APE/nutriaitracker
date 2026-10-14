import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface AiJob {
  id: string;
  status: JobStatus;
  output?: unknown;
  error?: string | null;
  kind: string;
}

/**
 * Realtime subscription to a single ai_jobs row. NO POLLING.
 *
 * Strategy:
 *  1. One initial fetch (covers jobs that completed before the hook mounted 
 *     no UPDATE event would fire for us in that case).
 *  2. A Supabase Realtime channel filtered by `user_id` (RLS-aligned). We
 *     filter to the specific job id client-side so that a single channel per
 *     user could be reused later if needed.
 *  3. Duplicate-update guard via `lastStatusRef`  terminal states
 *     ("done" / "failed") are committed exactly once. Stale callbacks after
 *     unmount are dropped via the `cancelled` flag.
 *  4. `removeChannel` on cleanup tears down the websocket binding so there are
 *     no leaks across remounts.
 */
export function useAiJobRealtime(jobId: string | null | undefined) {
  const { user } = useAuth();
  const [job, setJob] = useState<AiJob | null>(null);
  const lastStatusRef = useRef<JobStatus | null>(null);

  useEffect(() => {
    if (!jobId || !user?.id) {
      setJob(null);
      lastStatusRef.current = null;
      return;
    }

    let cancelled = false;

    const commit = (next: AiJob) => {
      if (cancelled) return;
      // Dedupe: ignore repeated events for the same status, and never
      // overwrite a terminal state with anything else.
      const prev = lastStatusRef.current;
      if (prev === next.status) return;
      if (prev === "done" || prev === "failed") return;
      lastStatusRef.current = next.status;
      setJob(next);
    };

    // 1. Initial fetch.
    (async () => {
      const { data } = await supabase
        .from("ai_jobs")
        .select("id, status, output, error, kind")
        .eq("id", jobId)
        .maybeSingle();
      if (data) commit(data as AiJob);
    })();

    // 2. Realtime  filter by user_id (matches RLS scope).
    // Each mounted job watcher needs its own channel name. Reusing the same
    // user-scoped name across multiple pending rows makes Supabase return the
    // already-subscribed channel instance, and calling `.on(...)` after that
    // throws "cannot add `postgres_changes` callbacks ... after `subscribe()`".
    const channel = supabase
      .channel(`ai-jobs-user-${user.id}-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as AiJob & { id: string };
          if (row.id !== jobId) return; // not ours
          commit(row);
        },
      )
      .subscribe();

    // 3. Cleanup  guarantees no state updates and no leaked channels.
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [jobId, user?.id]);

  return job;
}
