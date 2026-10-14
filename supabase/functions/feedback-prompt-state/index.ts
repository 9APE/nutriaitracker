import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireAuth } from "../_shared/auth.ts";
import {
  evaluateFeedbackPromptOpen,
  parseFeedbackPromptState,
} from "../_shared/feedback-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const userId = auth;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_KEY") ??
    "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: "Service not configured", code: "service_not_configured" });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error: rowError } = await sb
    .from("user_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (rowError) return json(500, { error: rowError.message, code: "state_load_failed" });

  const stateBag =
    row?.state && typeof row.state === "object" && !Array.isArray(row.state)
      ? { ...(row.state as Record<string, unknown>) }
      : {};

  const previous = parseFeedbackPromptState(stateBag.feedback_prompt);
  const outcome = evaluateFeedbackPromptOpen({
    previous,
    nowIso: new Date().toISOString(),
    nowMs: Date.now(),
  });

  stateBag.feedback_prompt = outcome.nextState as unknown as Record<string, unknown>;

  const { error: saveError } = await sb.from("user_state").upsert({
    user_id: userId,
    state: stateBag,
  });

  if (saveError) return json(500, { error: saveError.message, code: "state_save_failed" });

  return json(200, {
    ok: true,
    shouldPrompt: outcome.shouldPrompt,
    state: outcome.nextState,
    reason: outcome.reason,
  });
});
