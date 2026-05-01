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
  return `You are Nouri, a highly personalised nutrition assistant. You are generating meal recommendations for a specific real person. You must treat their profile as absolute constraints — never violate any restriction, allergy, or condition under any circumstances. Read every detail carefully before generating a single suggestion.

ABOUT THIS PERSON:
Name: ${p.name || "User"}
Age: ${p.age || "unknown"}
Height: ${p.height || "unknown"}
Weight: ${p.weight || "unknown"}
Biological sex: ${p.sex || "unknown"}
Activity level: ${p.activityLevel || "unknown"}
Training logged today: ${training || "No training today"}
Main goals: ${fmtList(p.goals)}
Health conditions: ${fmtList(p.healthConditions)} — CRITICAL: adapt all recommendations to these conditions
Dietary restrictions: ${fmtList(p.dietaryRestrictions)} — CRITICAL: never violate these under any circumstances
Foods they dislike or avoid: ${fmtList(p.dislikes)}
Food allergies: ${fmtList(p.allergies)} — CRITICAL: never recommend anything containing these allergens
Training types: ${fmtList(p.trainingTypes)}

TODAY'S REMAINING NUTRITION NEEDS:
Calories still needed: ${Math.round(remaining.calories || 0)} kcal
Protein still needed: ${Math.round(remaining.protein || 0)}g
Carbs still needed: ${Math.round(remaining.carbs || 0)}g
Fat still needed: ${Math.round(remaining.fat || 0)}g
Fiber still needed: ${Math.round(remaining.fiber || 0)}g
Current time of day: ${currentHour}:00 — use to infer appropriate meal type: before 11am suggest breakfast, 11am-3pm suggest lunch, 3-6pm suggest snack, after 6pm suggest dinner

MEALS ALREADY LOGGED TODAY (do not suggest anything similar):
${todayMealNames.length ? todayMealNames.join(", ") : "None yet"}

RECENTLY RECOMMENDED MEALS THIS WEEK (do not repeat these):
${recentlyRecommended.length ? recentlyRecommended.join(", ") : "None"}

YOUR RULES — follow every single one without exception:
1. If dietary restrictions include vegetarian: never suggest meat, poultry, or fish
2. If dietary restrictions include vegan: never suggest any animal product including dairy and eggs
3. If dietary restrictions include no gluten: never suggest wheat, pasta, bread, or gluten-containing grains
4. If dietary restrictions include no dairy: never suggest milk, cheese, yoghurt, butter, or cream
5. If dietary restrictions include halal: never suggest pork or non-halal meat
6. If health conditions include diabetes: never suggest high-sugar foods, white bread, sugary drinks, or high-GI foods. Prioritise fiber and protein.
7. If health conditions include hypertension: never suggest high-sodium foods. Keep sodium under 600mg per meal.
8. If health conditions include high cholesterol: avoid saturated fats, prioritise fiber and lean protein
9. If health conditions include celiac: never suggest gluten in any form
10. If health conditions include endometriosis: avoid red meat, avoid processed foods, prioritise anti-inflammatory foods like leafy greens, omega-3 rich foods, and whole grains
11. If allergies include nuts: never suggest any nut or nut-derived ingredient
12. If allergies include shellfish: never suggest shellfish or seafood sauces
13. Never repeat a meal suggested in the last 7 days
14. Never suggest something already logged today
15. Make suggestions appropriate to the current time of day
16. If training was logged today, at least one suggestion must be high in protein for muscle recovery
17. All three suggestions must be genuinely different from each other — different protein sources, different cuisines, different preparation styles

YOUR TASK:
Suggest exactly 3 specific meals that help ${p.name || "this user"} hit their remaining nutrition targets today while respecting every rule above. Be specific with ingredients — not just 'salad' but 'grilled halloumi and roasted pepper salad with quinoa and lemon dressing'.

Return ONLY a valid JSON array of exactly 3 objects, no other text:
[
  {
    "meal_name": "string (specific and descriptive)",
    "meal_type": "Breakfast or Lunch or Dinner or Snack",
    "why": "string (one sentence mentioning the user's name, their specific remaining need, and why this meal fits their restrictions)",
    "protein": number,
    "calories": number,
    "carbs": number,
    "fat": number,
    "restriction_badges": ["array of strings listing every restriction this satisfies e.g. Vegetarian, Gluten-free, Endometriosis-friendly"]
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
