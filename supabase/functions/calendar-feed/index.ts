// Public ICS calendar feed - subscribable via webcal:// on Apple/Google/Outlook
// No auth required; access controlled via opaque per-user calendar_token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLOT_TIMES: Record<string, [number, number]> = {
  breakfast: [8, 0],
  lunch: [12, 30],
  dinner: [18, 30],
  snack: [15, 30],
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toICSDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}
function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildEvent(meal: any, slot: string, dateISO: string, uid: string): string {
  const [h, m] = SLOT_TIMES[slot] ?? [12, 0];
  const start = new Date(dateISO + "T00:00:00Z");
  start.setUTCHours(h, m, 0, 0);
  const dur = Math.max(10, Math.min(240, meal.cook_time_min ?? 30));
  const end = new Date(start.getTime() + dur * 60 * 1000);

  const desc: string[] = [];
  const macros: string[] = [];
  if (meal.calories) macros.push(`${meal.calories} kcal`);
  if (meal.protein) macros.push(`${meal.protein}g P`);
  if (meal.carbs) macros.push(`${meal.carbs}g C`);
  if (meal.fat) macros.push(`${meal.fat}g F`);
  if (macros.length) desc.push(macros.join(" · "));
  if (meal.ingredients?.length) desc.push("\nIngredients:\n- " + meal.ingredients.join("\n- "));
  if (meal.cook_time_min) desc.push(`\nEstimated cook time: ${meal.cook_time_min} min`);

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(`Cook: ${meal.meal_name}`)}`,
    `DESCRIPTION:${escapeICS(desc.join("\n"))}`,
    `CATEGORIES:Cooking,Nutri AI`,
    "END:VEVENT",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("calendar_token", token)
    .maybeSingle();

  if (pErr || !profile) {
    return new Response("Invalid token", { status: 404, headers: corsHeaders });
  }

  const { data: plans } = await supabase
    .from("meal_plans")
    .select("week_key, plan")
    .eq("user_id", profile.id)
    .order("week_key", { ascending: false })
    .limit(8);

  const events: string[] = [];
  for (const row of plans ?? []) {
    const monday = new Date((row.week_key as string) + "T00:00:00Z");
    const plan = (row.plan as any)?.plan ?? row.plan;
    if (!plan || typeof plan !== "object") continue;
    DAYS.forEach((dayName, idx) => {
      const day = plan[dayName];
      if (!day) return;
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + idx);
      const dateISO = date.toISOString().slice(0, 10);
      for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
        const meal = day[slot];
        if (!meal?.meal_name) continue;
        const uid = `${row.week_key}-${dayName}-${slot}-${profile.id}@nouri.app`;
        events.push(buildEvent(meal, slot, dateISO, uid));
      }
    });
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nutri AI//Cook Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Nutri AI Cook Plan",
    "X-WR-TIMEZONE:UTC",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
});
