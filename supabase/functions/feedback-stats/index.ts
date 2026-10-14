import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const maintenanceKey = Deno.env.get("NUTRI_AI_MAINTENANCE_KEY") ?? "";
  const providedKey = req.headers.get("x-maintenance-key") ?? "";
  if (!maintenanceKey || providedKey !== maintenanceKey) {
    return json(401, { error: "Unauthorized" });
  }

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

  const { data, error } = await sb
    .from("feedback_submissions")
    .select("name, rating, message, created_at, email_sent")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return json(500, { error: error.message, code: "feedback_stats_failed" });

  const rows = data ?? [];
  const ratingCount = rows.length;
  const averageRating = ratingCount
    ? rows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / ratingCount
    : 0;

  return json(200, {
    ok: true,
    averageRating,
    ratingCount,
    recent: rows,
  });
});
