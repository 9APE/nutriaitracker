/**
 * Background AI job runner.
 *
 * Accepts a job request, immediately persists an `ai_jobs` row with status
 * `pending`, kicks off the underlying AI work in `EdgeRuntime.waitUntil(...)`,
 * and returns the job ID right away. Clients then subscribe via Supabase
 * Realtime (or poll) for status updates. This means a user can start an AI
 * task, navigate to another tab, and the result will still land when ready.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Kind =
  | "analyze-meal"
  | "nutrition-chat"
  | "plan-meals"
  | "generate-grocery-list"
  | "recommend-meals"
  | "suggest-meals";

const KINDS: Kind[] = [
  "analyze-meal",
  "nutrition-chat",
  "plan-meals",
  "generate-grocery-list",
  "recommend-meals",
  "suggest-meals",
];

async function callTarget(kind: Kind, body: unknown, authHeader: string): Promise<unknown> {
  const url = `${SUPABASE_URL}/functions/v1/${kind}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (parsed as { error?: string })?.error ?? `Upstream ${kind} failed (${res.status})`;
    throw new Error(msg);
  }
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userIdOrRes = await requireAuth(req);
  if (userIdOrRes instanceof Response) return userIdOrRes;
  const userId = userIdOrRes;
  const authHeader = req.headers.get("Authorization")!;

  let payload: { kind?: string; input?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const kind = payload.kind as Kind | undefined;
  if (!kind || !KINDS.includes(kind)) {
    return new Response(JSON.stringify({ error: `Unknown kind: ${kind}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client so we can write rows for this user without RLS
  // friction (we still scope by their userId).
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: job, error: insertErr } = await admin
    .from("ai_jobs")
    .insert({
      user_id: userId,
      kind,
      status: "running",
      input: payload.input ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !job) {
    return new Response(
      JSON.stringify({ error: insertErr?.message ?? "Failed to create job" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const jobId = job.id as string;

  // Run the actual AI work in the background. The HTTP response returns
  // immediately; the runtime keeps the worker alive until this resolves.
  const work = (async () => {
    try {
      const output = await callTarget(kind, payload.input, authHeader);
      await admin
        .from("ai_jobs")
        .update({ status: "done", output })
        .eq("id", jobId);
    } catch (e) {
      console.error("ai-job-run worker failed", kind, e);
      await admin
        .from("ai_jobs")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        })
        .eq("id", jobId);
    }
  })();

  // @ts-ignore — EdgeRuntime is provided by the Supabase Edge runtime.
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any)?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  } else {
    // Local dev fallback — just await it.
    await work;
  }

  return new Response(JSON.stringify({ jobId }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
