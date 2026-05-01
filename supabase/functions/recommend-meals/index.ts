// Nouri Recommends — 3 meal suggestions respecting full user profile
import { resolveLanguage } from "../_shared/language.ts";
import { EVIDENCE_SOURCES_INSTRUCTION } from "../_shared/evidence.ts";
import { requireAuth } from "../_shared/auth.ts";

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

function buildSystemPrompt(profile: Record<string, any>, totals: Record<string, number>, remaining: Record<string, number>, goals: Record<string, number>, todayMealNames: string[], training: string): string {
  const p = profile ?? {};
  return `You are Nouri, a personal nutrition assistant. You are about to recommend meals to a specific user. You MUST respect every single one of their preferences, restrictions, and conditions listed below without exception. Never recommend a food that conflicts with their dietary restrictions or health conditions. If the user is vegetarian, never suggest meat or fish. If the user is vegan, never suggest any animal products. If the user has diabetes, never suggest high-sugar or high-GI foods. If the user has a nut allergy, never suggest anything containing nuts. Apply every restriction simultaneously — a vegetarian diabetic must receive recommendations that are both meat-free AND low sugar.

FULL USER PROFILE:
- Name: ${p.name || "User"}
- Age: ${p.age || "unknown"}
- Height: ${p.height || "unknown"}
- Weight: ${p.weight || "unknown"}
- Sex: ${p.sex || "unknown"}
- Activity level: ${p.activityLevel || "unknown"}
- Main goals: ${fmtList(p.goals)}
- Health conditions: ${fmtList(p.healthConditions)} — CRITICAL: adapt all recommendations to these conditions
- Dietary restrictions: ${fmtList(p.dietaryRestrictions)} — CRITICAL: never violate these under any circumstances
- Foods they dislike or avoid: ${fmtList(p.dislikes)} — never recommend these
- Food allergies: ${fmtList(p.allergies)} — CRITICAL: never recommend anything containing these allergens
- Training types: ${fmtList(p.trainingTypes)}

TODAY'S PROGRESS:
- Calories consumed so far: ${Math.round(totals.calories || 0)} kcal
- Calories remaining: ${Math.round(remaining.calories || 0)} kcal
- Protein consumed: ${Math.round(totals.protein || 0)}g
- Protein remaining: ${Math.round(remaining.protein || 0)}g
- Carbs consumed: ${Math.round(totals.carbs || 0)}g
- Carbs remaining: ${Math.round(remaining.carbs || 0)}g
- Fat consumed: ${Math.round(totals.fat || 0)}g
- Fat remaining: ${Math.round(remaining.fat || 0)}g
- Fiber consumed: ${Math.round(totals.fiber || 0)}g
- Sugar consumed today: ${Math.round(totals.sugar || 0)}g (warn if close to limit)
- Sodium consumed today: ${Math.round(totals.sodium || 0)}mg (warn if close to limit)
- Training logged today: ${training || "none"}
- Meals already logged today: ${todayMealNames.length ? todayMealNames.join(", ") : "none yet"}

YOUR TASK:
Suggest exactly 3 specific realistic meals that would help this user hit their remaining targets for today. Each meal must:
1. Strictly respect ALL dietary restrictions and allergies listed above — this is non-negotiable
2. Be appropriate for their health conditions
3. Help close the gap on their most deficient macro or micronutrient for today
4. Not repeat any meal already logged today
5. Be realistic and easy to prepare
6. If training was logged today, at least one recommendation must be high in protein for recovery

Return ONLY a JSON array of exactly 3 objects with no extra text:
[
  {
    "meal_name": "string",
    "why": "string (one sentence explaining why this fits their profile AND their remaining targets today)",
    "protein": number,
    "calories": number,
    "carbs": number,
    "fat": number,
    "suitable_for": "string (e.g. Vegetarian, Diabetic-friendly — confirm it meets their restrictions)"
  }
]`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { remaining, totals, goals, profile, todayMealNames, training, language, languageName } = await req.json();
    const lang = resolveLanguage(language, languageName);
    if (!remaining) {
      return new Response(
        JSON.stringify({ error: "remaining is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(
      profile ?? {},
      totals ?? {},
      remaining,
      goals ?? {},
      todayMealNames ?? [],
      training ?? ""
    ) + "\n" + EVIDENCE_SOURCES_INSTRUCTION + lang.suffix;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: "Generate my 3 personalized meal recommendations now. Return JSON only." }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arr = Array.isArray(parsed) ? parsed : parsed.suggestions ?? [];
    const suggestions = arr.slice(0, 3).map((s: any) => ({
      meal_name: String(s.meal_name ?? "Meal"),
      why: String(s.why ?? ""),
      protein: Math.round(Number(s.protein) || 0),
      calories: Math.round(Number(s.calories) || 0),
      carbs: Math.round(Number(s.carbs) || 0),
      fat: Math.round(Number(s.fat) || 0),
      suitable_for: String(s.suitable_for ?? ""),
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-meals error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
