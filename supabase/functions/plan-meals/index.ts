// NutriAI: AI weekly meal planner (up to 7 days x 4 meals)
import { resolveLanguage } from "../_shared/language.ts";
import { requireAuth } from "../_shared/auth.ts";
import { formatNutritionistContext } from "../_shared/nutritionist-context.ts";

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
  familyMembers?: Record<string, any>[],
  householdSize?: number,
  languageName?: string,
  cuisines?: string[],
  mixedDiet?: boolean,
  proteinByMember?: Record<string, number>,
  nutritionistContext?: Record<string, any>,
  planDays: string[] = DAYS,
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

  const familyMembersBlock = familyMode && Array.isArray(familyMembers) && familyMembers.length
    ? `\nIncluded family members:\n${familyMembers.map((member) => {
      const targets = member.dailyTargets && typeof member.dailyTargets === "object"
        ? `${Number(member.dailyTargets.calories) || 0} kcal, ${Number(member.dailyTargets.protein) || 0}g protein`
        : "targets not set";
      return `- ${member.name || "Family member"} | age ${member.age ?? "unknown"} | goals: ${fmtList(member.goals)} | restrictions: ${fmtList(member.restrictions)} | allergies: ${fmtList(member.allergies)} | conditions: ${fmtList(member.conditions)} | dislikes: ${fmtList(member.dislikes)} | targets: ${targets}`;
    }).join("\n")}`
    : "";

  const cuisineBlock = cuisines && cuisines.length
    ? `\nPreferred cuisines: ${cuisines.join(", ")}. Favor these but vary across the week.`
    : "";

  const mixedBlock = mixedDiet
    ? `\nMIXED-DIET HOUSEHOLD: Members include both meat-eaters and vegetarians/vegans. Prefer one shared base meal with personalised protein swaps instead of completely separate meals (e.g. rice bowl base with chicken for meat eaters and tofu for vegetarian members). For at least 3 of 7 dinners, add a "shared_base" string and a "personalised_swaps" array with one entry per affected person: [{"person":"Name","swap":"tofu instead of chicken","reason":"Vegetarian"}]. You may also include the existing "variants" object for broad omnivore/vegetarian/vegan variants. Per-member protein targets: ${JSON.stringify(proteinByMember ?? {})}.`
    : "";

  const avoidBlock = recentMealNames.length
    ? `\nAvoid repeating: ${recentMealNames.slice(0, 30).join(", ")}`
    : "";

  return `${restrictionBlock}${familyBlock}${familyMembersBlock}${cuisineBlock}${mixedBlock}${avoidBlock}

${p.name || "User"} | ${p.age || "?"} | ${p.sex || "?"} | Activity: ${p.activityLevel || "?"} | Goals: ${fmtList(p.goals)} | Avoid: ${fmtList(p.dislikes)}
Daily targets: ${goals.calories || 2000}kcal, ${goals.protein || 150}gP, ${goals.carbs || 200}gC, ${goals.fat || 70}gF

${formatNutritionistContext(nutritionistContext)}

Generate a plan for exactly these days: ${planDays.join(", ")}. Include 4 meals each (breakfast,lunch,dinner,snack) and no other days. Vary proteins. Concise meal_name (5 words max). Include realistic cook_time_min (integer minutes, total active+passive).
In family mode, consider only the included family members listed above plus the user. Keep meals shared where practical and use personalised swaps for individual restrictions, allergies, dislikes, or diet preferences. Do not make the whole household vegetarian unless every included person needs that.
Use the Nutri AI colour context as the source of truth. Do not plan meals that worsen RED/ORANGE limit nutrients when safer alternatives exist.
${languageName ? `All text in ${languageName}.` : ""}
Return ONLY JSON: {"plan":{"Monday":{"breakfast":{"meal_name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"cook_time_min":15,"shared_base":"optional shared base","personalised_swaps":[{"person":"Name","swap":"ingredient swap","reason":"restriction"}]},...},...}}`;
}

async function callAI(systemPrompt: string, userMsg: string, maxTokens = 3000): Promise<string> {
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
      max_tokens: maxTokens,
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
      familyMembers,
      householdSize,
      swapDay,
      swapMealType,
      existingPlan,
      language,
      languageName,
      cuisinePreferences,
      mixedDiet,
      proteinByMember,
      nutritionistContext,
      selectedDays,
    } = await req.json();

    // Only generate the days the client asked for (indices into DAYS).
    // Generating fewer days keeps the response small enough to avoid truncated JSON.
    const requestedDays: string[] = Array.isArray(selectedDays)
      ? DAYS.filter((_, i) => selectedDays.includes(i))
      : [];
    const planDays = requestedDays.length ? requestedDays : DAYS;

    const lang = resolveLanguage(language, languageName);

    // Resolve cuisine preferences: prefer family-merged, fall back to user's own.
    const effectiveCuisines: string[] = Array.isArray(cuisinePreferences) && cuisinePreferences.length
      ? cuisinePreferences
      : (familyMode && familyRestrictions?.cuisinePreferences) || profile?.cuisinePreferences || [];

    const systemPrompt = buildSystemPrompt(
      profile ?? {},
      goals ?? {},
      recentMealNames ?? [],
      Boolean(familyMode),
      familyRestrictions,
      familyMembers,
      householdSize,
      lang.name,
      effectiveCuisines,
      Boolean(mixedDiet ?? familyRestrictions?.dietProfile?.mixed),
      proteinByMember ?? familyRestrictions?.dietProfile?.proteinByMember,
      nutritionistContext,
      planDays,
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

    // Each meal costs ~120 output tokens; 28 meals overflowed the old 3000 cap
    // and produced truncated, unparseable JSON.
    const maxTokens = Math.min(8000, 800 + planDays.length * 1100);
    raw = await callAI(
      systemPrompt,
      `Generate the meal plan for ${planDays.join(", ")} now. Return JSON only.`,
      maxTokens,
    );

    let parsed: any;
    try {
      parsed = extractJson(raw);
    } catch {
      console.warn("[plan-meals] JSON parse failed, retrying...");
      const retryRaw = await callAI(systemPrompt,
        `Generate the meal plan for ${planDays.join(", ")}. Return ONLY the JSON object with no other text, starting with { and ending with }. Keep meal_name short and omit optional fields.`,
        maxTokens);
      try { parsed = extractJson(retryRaw); } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Validate structure: ensure every requested day and all 4 meal types are present
    const plan = parsed?.plan ?? {};
    for (const day of planDays) {
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
