import { supabase } from "@/integrations/supabase/client";
import { useAiJobRealtime } from "./useAiJobRealtime";

export type { AiJob, JobStatus } from "./useAiJobRealtime";
export { useAiJobRealtime } from "./useAiJobRealtime";

/**
 * @deprecated Use `useAiJobRealtime` directly. Kept as a thin alias so existing
 * call sites continue to work while we migrate. No polling  pure realtime.
 */
export const useAiJob = useAiJobRealtime;

/**
 * Kick off a background AI job. Returns the new job id immediately (HTTP 202
 * from the edge function). Pair with `useAiJobRealtime(id)` to track it.
 */
export async function startAiJob(
  kind:
    | "analyze-meal"
    | "nutrition-chat"
    | "plan-meals"
    | "generate-grocery-list"
    | "recommend-meals"
    | "suggest-meals",
  input: unknown,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-job-run", {
    body: { kind, input },
  });
  if (error) throw new Error(error.message);
  if (!data?.jobId) throw new Error("Job did not return an id");
  return data.jobId as string;
}
