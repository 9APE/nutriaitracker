// NutriAI — AI weekly meal planner (7 days × 4 meals)
import { resolveLanguage } from "../_shared/language.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function fmtList(v: unknown, fallback = "None"): string {
  if (Array.isArray(v) && v.length) return v.join(", ");
  if (typeof v === "string" && v.trim()) return v;
  return fallback;
}

function buildSystemPrompt(
  profile: Record<string, any>,
  goals: Record<string, number>,
  recentMealNames: string[],
  familyMode: boolean,
  familyRestrictions?: Record<string, any>,
  householdSize?: number,
  languageName?: string,
): string {
  const p = profile ?? {};
  const effectiveProfile = familyMode && familyRestrictions ? familyRestrictions : p;

  const restrictionBlock = `Restrictions: ${fmtList(effectiveProfile.restrictions)}
Allergies: ${fmtList(effectiveProfile.allergies)}
Conditions: ${fmtList(effectiveProfile.conditions)}
NEVER violate these. Vegetarian=no meat/fish. Vegan=no animal products. Gluten-free=no wheat/barley/rye.`;

  const familyBlock = familyMode && familyRestrictions
    ? `\nHousehold: ${householdSize ?? 1} people. Add "servings": ${householdSize ?? 1} to each meal.`
    : "";

  const avoidBlock = recentMealNames.length
    ? `\nAvoid repeating: ${recentMealNames.slice(0, 30).join(", ")}`
    : "";

  return `${restrictionBlock}${familyBlock}${avoidBlock}

${p.name || "User"} | ${p.age || "?"} | ${p.sex || "?"} | Activity: ${p.activityLevel || "?"} | Goals: ${fmtList(p.goals)} | Avoid: ${fmtList(p.dislikes)}
Daily targets: ${goals.calories || 2000}kcal, ${goals.protein || 150}gP, ${goals.carbs || 200}gC, ${goals.fat || 70}gF

Generate 7-day plan (Mon-Sun), 4 meals each (breakfast,lunch,dinner,snack). Vary proteins. Concise meal_name (5 words max).
${languageName ? `All text in ${languageName}.` : ""}
Return ONLY JSON: {"plan":{"Monday":{"breakfast":{"meal_name":"...","calories":0,"protein":0,"carbs":0,"fat":0},...},...}}`;
}

async function callAI(systemPrompt: string, userMsg: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

function extractJson(raw: string): any {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const str = fence ? fence[1].trim() : raw.trim();
  const objMatch = str.match(/\{[\s\S]*\}/);
  return JSON.parse(objMatch ? objMatch[0] : str);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const {
      profile,
      goals,
      recentMealNames,
      familyMode,
      familyRestrictions,
      householdSize,
      swapDay,
      swapMealType,
      existingPlan,
      language,
      languageName,
    } = await req.json();

    const lang = resolveLanguage(language, languageName);
    const systemPrompt = buildSystemPrompt(
      profile ?? {},
      goals ?? {},
      recentMealNames ?? [],
      Boolean(familyMode),
      familyRestrictions,
      householdSize,
      lang.name,
    );

    let raw: string;

    // Swap mode: regenerate only one meal slot (much cheaper than full plan)
    if (swapDay && swapMealType && existingPlan) {
      const swapMsg = `Regenerate only the ${swapMealType} for ${swapDay}. Do not change any other day or meal. The current ${swapMealType} for ${swapDay} is: ${JSON.stringify(existingPlan?.plan?.[swapDay]?.[swapMealType] ?? {})}. Return ONLY valid JSON for that one meal slot: { "meal_name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "why": "..." }`;
      raw = await callAI(systemPrompt, swapMsg);
      try {
        const swapped = extractJson(raw);
        return new Response(JSON.stringify({ swapped, day: swapDay, mealType: swapMealType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse swap response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Full 7-day plan
    raw = await callAI(systemPrompt, "Generate the complete 7-day meal plan now. Return JSON only.");

    let parsed: any;
    try {
      parsed = extractJson(raw);
    } catch {
      console.warn("[plan-meals] JSON parse failed, retrying...");
      const retryRaw = await callAI(systemPrompt,
        "Your previous response was not valid JSON. Return ONLY the JSON object with no other text, starting with { and ending with }.");
      try { parsed = extractJson(retryRaw); } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Validate structure — ensure all 7 days and 4 meal types are present
    const plan = parsed?.plan ?? {};
    for (const day of DAYS) {
      if (!plan[day]) plan[day] = {};
      for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
        if (!plan[day][slot]) {
          plan[day][slot] = { meal_name: "Balanced meal", calories: 400, protein: 30, carbs: 40, fat: 15, why: "Fallback suggestion." };
        }
      }
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-meals error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
