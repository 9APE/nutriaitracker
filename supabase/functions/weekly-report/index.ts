// Weekly report — generates an encouraging summary via Claude
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Stats {
  totalMeals: number;
  proteinDaysHit: number;
  avgCalories: number;
  streak: number;
  xpThisWeek: number;
  proteinGoal?: number;
  calorieGoal?: number;
}

function buildPrompt(name: string, stats: Stats) {
  return `Generate an encouraging 2-3 sentence weekly summary for ${name || "friend"} based on these stats:
- Meals logged this week: ${stats.totalMeals}
- Days protein goal hit: ${stats.proteinDaysHit} / 7${stats.proteinGoal ? ` (goal: ${stats.proteinGoal}g)` : ""}
- Average daily calories: ${stats.avgCalories}${stats.calorieGoal ? ` kcal (goal: ${stats.calorieGoal})` : " kcal"}
- Current streak: ${stats.streak} days
- XP earned this week: ${stats.xpThisWeek}

Mention one thing they did well and one gentle suggestion for next week. Warm, personal tone. No emojis except at most one. Plain text only — no markdown, no bullet points.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const name = String(body?.name ?? "friend");
    const stats: Stats = {
      totalMeals: Number(body?.stats?.totalMeals ?? 0),
      proteinDaysHit: Number(body?.stats?.proteinDaysHit ?? 0),
      avgCalories: Math.round(Number(body?.stats?.avgCalories ?? 0)),
      streak: Number(body?.stats?.streak ?? 0),
      xpThisWeek: Number(body?.stats?.xpThisWeek ?? 0),
      proteinGoal: body?.stats?.proteinGoal ? Number(body.stats.proteinGoal) : undefined,
      calorieGoal: body?.stats?.calorieGoal ? Number(body.stats.calorieGoal) : undefined,
    };
    const lang = resolveLanguage(body?.language);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        system:
          "You are Nouri, a warm, supportive nutrition coach. Speak directly to the user in a friendly, encouraging tone." +
          lang.suffix,
        messages: [{ role: "user", content: buildPrompt(name, stats) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error", response.status, errText);
      return new Response(JSON.stringify({ error: `Anthropic ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = (data?.content?.[0]?.text ?? "").trim();

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
