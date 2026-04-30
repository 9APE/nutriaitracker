// Nouri Recommends — 3 meal suggestions to hit remaining macros
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmtList(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none specified";
  if (typeof v === "string" && v.trim()) return v;
  return "none specified";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { remaining, profile, language, languageName } = await req.json();
    const lang = resolveLanguage(language, languageName);
    if (!remaining) {
      return new Response(
        JSON.stringify({ error: "remaining is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const p = profile ?? {};
    const goals = fmtList(p.goals);
    const restrictions = fmtList(p.dietaryRestrictions);
    const regularFoods = fmtList(p.regularFoods);

    const userMessage = `The user has ${Math.round(remaining.protein)}g protein, ${Math.round(
      remaining.calories
    )} kcal, ${Math.round(remaining.carbs)}g carbs, and ${Math.round(
      remaining.fat
    )}g fat left for today. Based on their profile (goals: ${goals}, dietary restrictions: ${restrictions}, foods they like: ${regularFoods}), suggest exactly 3 specific meals that would fit their remaining targets. Return ONLY a JSON array of 3 objects, each with: meal_name (string), why (one short sentence explaining why it fits), protein (number), calories (number).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system: lang.suffix.trim(),
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI request failed", details: errText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const raw: string = data?.content?.[0]?.text ?? "";

    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonStr = arrMatch[0];

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse Claude output:", raw);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arr = Array.isArray(parsed) ? parsed : parsed.suggestions ?? [];
    const suggestions = arr.slice(0, 3).map((s: any) => ({
      meal_name: String(s.meal_name ?? "Meal"),
      why: String(s.why ?? ""),
      protein: Math.round(Number(s.protein) || 0),
      calories: Math.round(Number(s.calories) || 0),
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-meals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
