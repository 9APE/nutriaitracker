// Nouri Recommends — 3 fresh personalised meal suggestions every time
import { resolveLanguage } from "../_shared/language.ts";
import { EVIDENCE_SOURCES_INSTRUCTION } from "../_shared/evidence.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmtList(v: unknown, fallback = "None"): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : fallback;
  if (typeof v === "string" && v.trim()) return v;
  return fallback;
}

function buildSystemPrompt(
  profile: Record<string, any>,
  totals: Record<string, number>,
  remaining: Record<string, number>,
  todayMealNames: string[],
  training: string,
  recentlyRecommended: string[],
  currentHour: number
): string {
  const p = profile ?? {};

  // Log restrictions server-side for debugging
  console.log("[recommend-meals] Profile restrictions:", {
    dietaryRestrictions: p.dietaryRestrictions,
    allergies: p.allergies,
    healthConditions: p.healthConditions,
    dislikes: p.dislikes,
    name: p.name,
  });

  return `CRITICAL DIETARY RESTRICTIONS — YOU MUST NEVER VIOLATE THESE:
${fmtList(p.dietaryRestrictions)}

CRITICAL FOOD ALLERGIES — NEVER INCLUDE THESE INGREDIENTS:
${fmtList(p.allergies)}

CRITICAL HEALTH CONDITIONS — ADAPT ALL RECOMMENDATIONS:
${fmtList(p.healthConditions)}

If VEGETARIAN is listed above: every single suggestion must contain zero meat, zero poultry, zero fish, zero seafood. No exceptions.
If VEGAN is listed above: every single suggestion must contain zero animal products including dairy and eggs.
If GLUTEN-FREE is listed above: no wheat, no pasta, no bread, no barley, no rye.
If NO DAIRY is listed above: no milk, no cheese, no yoghurt, no butter, no cream.
If HALAL is listed above: no pork or non-halal meat.
If ENDOMETRIOSIS is listed above: avoid red meat and processed foods, prioritise anti-inflammatory ingredients like leafy greens, legumes, berries, and omega-3 sources.
If DIABETES is listed above: never suggest high-sugar foods, white bread, sugary drinks, or high-GI foods. Prioritise fiber and protein.
If HYPERTENSION is listed above: never suggest high-sodium foods. Keep sodium under 600mg per meal.
If HIGH CHOLESTEROL is listed above: avoid saturated fats, prioritise fiber and lean protein.
If CELIAC is listed above: never suggest gluten in any form.
If NUTS allergy is listed above: never suggest any nut or nut-derived ingredient.
If SHELLFISH allergy is listed above: never suggest shellfish or seafood sauces.

USER PROFILE:
Name: ${p.name || "User"}
Age: ${p.age || "unknown"}
Height: ${p.height || "unknown"}
Weight: ${p.weight || "unknown"}
Sex: ${p.sex || "unknown"}
Activity level: ${p.activityLevel || "unknown"}
Goals: ${fmtList(p.goals)}
Foods to avoid: ${fmtList(p.dislikes)}
Training types: ${fmtList(p.trainingTypes)}
Training today: ${training || "None"}

TODAY'S REMAINING NEEDS:
Calories remaining: ${Math.round(remaining.calories || 0)} kcal
Protein remaining: ${Math.round(remaining.protein || 0)}g
Carbs remaining: ${Math.round(remaining.carbs || 0)}g
Fat remaining: ${Math.round(remaining.fat || 0)}g
Fiber remaining: ${Math.round(remaining.fiber || 0)}g
Current time: ${currentHour}:00 — before 11am suggest breakfast, 11am-3pm lunch, 3-6pm snack, after 6pm dinner

MEALS ALREADY LOGGED TODAY — DO NOT SUGGEST ANYTHING SIMILAR:
${todayMealNames.length ? todayMealNames.join(", ") : "None"}

MEALS SUGGESTED IN THE LAST 7 DAYS — DO NOT REPEAT:
${recentlyRecommended.length ? recentlyRecommended.join(", ") : "None"}

ADDITIONAL RULES:
- Never repeat a meal from the last 7 days
- Never suggest something already logged today
- If training was logged today, at least one suggestion must be high in protein
- All three suggestions must be genuinely different — different protein sources, different cuisines

YOUR TASK:
Suggest exactly 3 specific meals for ${p.name || "this user"}. Be specific with ingredients. Before finalising each suggestion, verify it against every restriction listed at the top. If a suggestion contains any restricted ingredient, replace it immediately.

Return ONLY a valid JSON array of exactly 3 objects:
[
  {
    "meal_name": "string (specific and descriptive)",
    "meal_type": "Breakfast or Lunch or Dinner or Snack",
    "why": "string (one sentence mentioning the user's name and why this fits their restrictions)",
    "protein": number,
    "calories": number,
    "carbs": number,
    "fat": number,
    "restriction_badges": ["array of strings — list each specific restriction respected e.g. Vegetarian, Gluten-free, Endometriosis-friendly. Never use generic badges like 'No restrictions violated'."]
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

    const {
      remaining,
      totals,
      goals,
      profile,
      todayMealNames,
      training,
      recentlyRecommended,
      currentHour,
      language,
      languageName,
    } = await req.json();

    const lang = resolveLanguage(language, languageName);

    if (!remaining) {
      return new Response(
        JSON.stringify({ error: "remaining is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt =
      buildSystemPrompt(
        profile ?? {},
        totals ?? {},
        remaining,
        todayMealNames ?? [],
        training ?? "",
        recentlyRecommended ?? [],
        typeof currentHour === "number" ? currentHour : new Date().getHours()
      ) +
      "\n" +
      EVIDENCE_SOURCES_INSTRUCTION +
      lang.suffix;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "Generate my 3 personalized meal recommendations now. Return JSON only.",
          },
        ],
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
    } catch {
      console.error("Failed to parse Claude output:", raw);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arr = Array.isArray(parsed) ? parsed : parsed.suggestions ?? [];
    const suggestions = arr.slice(0, 3).map((s: any) => ({
      meal_name: String(s.meal_name ?? "Meal"),
      meal_type: String(s.meal_type ?? ""),
      why: String(s.why ?? ""),
      protein: Math.round(Number(s.protein) || 0),
      calories: Math.round(Number(s.calories) || 0),
      carbs: Math.round(Number(s.carbs) || 0),
      fat: Math.round(Number(s.fat) || 0),
      restriction_badges: Array.isArray(s.restriction_badges)
        ? s.restriction_badges.map(String)
        : s.suitable_for
        ? [String(s.suitable_for)]
        : [],
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
