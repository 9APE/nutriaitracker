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

  const restrictionBlock = `CRITICAL DIETARY RESTRICTIONS — YOU MUST NEVER VIOLATE THESE:
${fmtList(effectiveProfile.restrictions)}

CRITICAL FOOD ALLERGIES — NEVER INCLUDE THESE INGREDIENTS:
${fmtList(effectiveProfile.allergies)}

CRITICAL HEALTH CONDITIONS — ADAPT ALL MEALS:
${fmtList(effectiveProfile.conditions)}

If VEGETARIAN is listed: every meal must contain zero meat, zero poultry, zero fish.
If VEGAN is listed: every meal must contain zero animal products including dairy and eggs.
If GLUTEN-FREE is listed: no wheat, pasta, bread, barley, or rye in any form.
If KIDNEY DISEASE is listed: limit potassium, phosphorus, protein, and sodium in every meal.
If DIABETES is listed: no high-sugar foods, no high-GI carbohydrates.
If HYPERTENSION is listed: keep sodium under 600 mg per meal.`;

  const familyBlock = familyMode && familyRestrictions
    ? `\nHousehold: ${fmtList(familyRestrictions.memberNames)} (${householdSize ?? 1} people). Add "servings: ${householdSize ?? 1}" to each meal.`
    : "";

  const avoidBlock = recentMealNames.length
    ? `\nDO NOT REPEAT THESE MEALS (recently used):\n${recentMealNames.slice(0, 60).join(", ")}`
    : "";

  return `${restrictionBlock}
${familyBlock}
${avoidBlock}

USER PROFILE:
Name: ${p.name || "User"} | Age: ${p.age || "unknown"} | Sex: ${p.sex || "unknown"}
Activity: ${p.activityLevel || "unknown"} | Goals: ${fmtList(p.goals)}
Foods to avoid: ${fmtList(p.dislikes)}

DAILY NUTRITION TARGETS:
Calories: ${goals.calories || 2000} kcal | Protein: ${goals.protein || 150}g | Carbs: ${goals.carbs || 200}g | Fat: ${goals.fat || 70}g

TASK:
Generate a 7-day meal plan (Monday to Sunday). Each day has exactly 4 meals: Breakfast, Lunch, Dinner, Snack.
Rules:
1. Every meal MUST comply with all restrictions listed above — check each one before including it.
2. Vary protein sources across days (no chicken every day, no same dish twice in one week).
3. Keep daily macros close to the targets above.
4. Keep meal descriptions concise (5 words max for meal_name).
5. Provide realistic macro estimates.
${familyMode ? `6. Include "servings": ${householdSize ?? 1} in each meal object.` : ""}
${languageName ? `7. All text must be in ${languageName}.` : ""}

Return ONLY valid JSON — no markdown fences, no extra text. Exact schema:
{
  "plan": {
    "Monday":    { "breakfast": { "meal_name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "why": "..." }, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "Tuesday":   { ... },
    "Wednesday": { ... },
    "Thursday":  { ... },
    "Friday":    { ... },
    "Saturday":  { ... },
    "Sunday":    { ... }
  }
}`;
}

async function callAI(systemPrompt: string, userMsg: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

  const res = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
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
