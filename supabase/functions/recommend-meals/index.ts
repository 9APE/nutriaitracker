// NutriAI — 3 personalised meal suggestions with condition alerts + country guidelines
import { resolveLanguage } from "../_shared/language.ts";
import { EVIDENCE_SOURCES_INSTRUCTION } from "../_shared/evidence.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types (mirror src/lib) ────────────────────────────────────────────────────

interface ConditionAlertRow {
  nutrient: string;
  label: string;
  direction: "min" | "max";
  dailyTargetMg: number;
  unit: string;
  amberTip: string;
}

const CONDITION_NUTRIENT_MAP: Record<string, ConditionAlertRow[]> = {
  "Celiac Disease":         [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 25000, unit: "g",   amberTip: "Many GF products are low fibre. Try quinoa, buckwheat, lentils, or chia seeds." },
                             { nutrient: "calcium",   label: "Calcium",        direction: "min", dailyTargetMg: 1000,  unit: "mg",  amberTip: "Villous atrophy reduces calcium absorption. Fortified GF oat milk + leafy greens." },
                             { nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 18,    unit: "mg",  amberTip: "Pair plant iron with vitamin C. Avoid tea/coffee with meals." }],
  "Crohn's Disease":        [{ nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 18,    unit: "mg",  amberTip: "Chronic GI bleeding depletes iron. Well-cooked lean beef + vitamin C." },
                             { nutrient: "zinc",      label: "Zinc",           direction: "min", dailyTargetMg: 11,    unit: "mg",  amberTip: "Zinc lost via diarrhoea. Pumpkin seeds, chickpeas, cashews." }],
  "Ulcerative Colitis":     [{ nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 18,    unit: "mg",  amberTip: "Blood loss through stool depletes iron. Lean meat or legumes + vitamin C." }],
  "Type 2 Diabetes":        [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 25000, unit: "g",   amberTip: "Soluble fibre slows glucose absorption. Target ≥25 g/day." },
                             { nutrient: "sugar",     label: "Added Sugars",   direction: "max", dailyTargetMg: 25000, unit: "g",   amberTip: "Keep added sugars under 25 g (6 tsp) per day." }],
  "Type 1 Diabetes":        [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 25000, unit: "g",   amberTip: "Consistent fibre intake helps insulin dosing predictability." }],
  "Hypertension":           [{ nutrient: "sodium",    label: "Sodium",         direction: "max", dailyTargetMg: 1500,  unit: "mg",  amberTip: "Target < 1500 mg/day. Avoid canned soups, deli meat, soy sauce." },
                             { nutrient: "potassium", label: "Potassium",      direction: "min", dailyTargetMg: 4700,  unit: "mg",  amberTip: "Bananas, spinach, sweet potato, avocado boost potassium for BP control." }],
  "High Cholesterol":       [{ nutrient: "fiber",     label: "Soluble Fibre",  direction: "min", dailyTargetMg: 10000, unit: "g",   amberTip: "10 g/day soluble fibre lowers LDL ~5%. Oats, psyllium, lentils, apples." }],
  "Endometriosis":          [{ nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 18,    unit: "mg",  amberTip: "Heavy menstrual loss depletes iron. Red meat 2×/week or lentils + vitamin C." },
                             { nutrient: "omega3",    label: "Omega-3",        direction: "min", dailyTargetMg: 2000,  unit: "mg",  amberTip: "Anti-inflammatory EPA+DHA may reduce pelvic pain. Salmon, walnuts, flaxseed." }],
  "Hypothyroidism":         [{ nutrient: "iodine",    label: "Iodine",         direction: "min", dailyTargetMg: 0.15,  unit: "mg",  amberTip: "Iodine essential for T3/T4. Iodised salt, dairy, white fish." },
                             { nutrient: "selenium",  label: "Selenium",       direction: "min", dailyTargetMg: 0.055, unit: "mg",  amberTip: "Selenium activates thyroid hormones. 1–2 Brazil nuts/day." }],
  "Kidney Disease":         [{ nutrient: "potassium", label: "Potassium",      direction: "max", dailyTargetMg: 2000,  unit: "mg",  amberTip: "Avoid banana, tomato, potato, OJ. Check with nephrologist." },
                             { nutrient: "phosphorus",label: "Phosphorus",     direction: "max", dailyTargetMg: 800,   unit: "mg",  amberTip: "Avoid cola, processed meats, dairy excess." },
                             { nutrient: "sodium",    label: "Sodium",         direction: "max", dailyTargetMg: 1500,  unit: "mg",  amberTip: "Strict sodium limit prevents fluid retention in CKD." },
                             { nutrient: "protein",   label: "Protein",        direction: "max", dailyTargetMg: 50000, unit: "g",   amberTip: "0.6–0.8 g/kg body weight for CKD stages 3–5." }],
  "Osteoporosis":           [{ nutrient: "calcium",   label: "Calcium",        direction: "min", dailyTargetMg: 1200,  unit: "mg",  amberTip: "1200 mg/day. Dairy, fortified plant milk, sardines with bones, bok choy." },
                             { nutrient: "vitamin_d", label: "Vitamin D",      direction: "min", dailyTargetMg: 20,    unit: "mcg", amberTip: "Vitamin D is required for calcium absorption. 20 mcg (800 IU) minimum." }],
  "Iron Deficiency Anaemia":[{ nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 27,    unit: "mg",  amberTip: "Therapeutic 27 mg/day. Lean red meat, fortified cereal + vitamin C. Avoid tea with meals." }],
  "PCOS":                   [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 25000, unit: "g",   amberTip: "High fibre reduces PCOS insulin resistance. Legumes, oats, non-starchy veg." },
                             { nutrient: "sugar",     label: "Added Sugars",   direction: "max", dailyTargetMg: 25000, unit: "g",   amberTip: "Minimise added sugars to control insulin spikes." }],
  "Pregnancy":              [{ nutrient: "folate",    label: "Folate",         direction: "min", dailyTargetMg: 0.6,   unit: "mg",  amberTip: "CRITICAL: 600 mcg/day to prevent neural tube defects. Supplement essential." },
                             { nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 27,    unit: "mg",  amberTip: "Iron demand doubles in pregnancy. 27 mg/day. Red meat, legumes + vitamin C." }],
  "Heart Disease":          [{ nutrient: "sodium",    label: "Sodium",         direction: "max", dailyTargetMg: 1500,  unit: "mg",  amberTip: "< 1500 mg sodium reduces cardiac workload." },
                             { nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 25000, unit: "g",   amberTip: "Soluble fibre lowers LDL. Oats, barley, beans." }],
  "Vegetarian":             [{ nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 32,    unit: "mg",  amberTip: "Plant iron 2–3× less absorbed. Target 32 mg. Lentils, tofu, spinach + vitamin C." },
                             { nutrient: "b12",       label: "Vitamin B12",    direction: "min", dailyTargetMg: 2.4,   unit: "mcg", amberTip: "B12 only in animal products. Eggs, dairy, or fortified foods daily." }],
  "Vegan":                  [{ nutrient: "b12",       label: "Vitamin B12",    direction: "min", dailyTargetMg: 2.4,   unit: "mcg", amberTip: "MANDATORY SUPPLEMENT. No reliable plant-based B12 source." },
                             { nutrient: "iron",      label: "Iron",           direction: "min", dailyTargetMg: 32,    unit: "mg",  amberTip: "Target 32 mg. Lentils, tofu, tempeh, fortified cereals + vitamin C." },
                             { nutrient: "calcium",   label: "Calcium",        direction: "min", dailyTargetMg: 1000,  unit: "mg",  amberTip: "Fortified plant milk (≥300 mg/250 ml), calcium-set tofu, bok choy, kale." },
                             { nutrient: "omega3",    label: "DHA/EPA",        direction: "min", dailyTargetMg: 250,   unit: "mg",  amberTip: "Algae-based DHA supplement (250–500 mg/day) essential." }],
  "Obesity":                [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 30000, unit: "g",   amberTip: "High fibre increases satiety. Target 30 g+. Legumes, wholegrains." }],
  "IBS":                    [{ nutrient: "fiber",     label: "Dietary Fibre",  direction: "min", dailyTargetMg: 20000, unit: "g",   amberTip: "Moderate soluble fibre only. Avoid insoluble excess and high-FODMAP foods during flares." }],
};

const COUNTRY_PROMPT: Record<string, string> = {
  AU:    "Follow NHMRC (Australian National Health and Medical Research Council) Nutrient Reference Values 2017. Show kcal and kJ (1 kcal = 4.184 kJ). Reference eatforhealth.gov.au.",
  DE:    "Follow EFSA Dietary Reference Values (DRV 2019) and DGE guidelines. Cite efsa.europa.eu or dge.de.",
  FR:    "Follow ANSES ANC 2021 guidelines and PNNS4 food pyramid. Cite anses.fr.",
  GB:    "Follow NHS Eatwell Guide and SACN Dietary Reference Values. Cite nhs.uk.",
  US:    "Follow USDA Dietary Guidelines 2020–2025 and FDA Daily Values. Reference MyPlate. Cite dietaryguidelines.gov.",
  IN:    "Follow ICMR-NIN Dietary Guidelines for Indians 2024. Reference regional food patterns. Cite nin.res.in.",
  OTHER: "Follow WHO/FAO Nutrient Requirements 2004 and WHO Healthy Diet guidelines. Cite who.int.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtList(v: unknown, fallback = "None"): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : fallback;
  if (typeof v === "string" && v.trim()) return v;
  return fallback;
}

function buildConditionAlertsBlock(conditions: string[]): string {
  if (!conditions.length) return "";
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const condition of conditions) {
    for (const a of CONDITION_NUTRIENT_MAP[condition] ?? []) {
      if (seen.has(a.nutrient)) continue;
      seen.add(a.nutrient);
      lines.push(`  • ${condition}: ${a.label} — ${a.direction === "min" ? "prioritise ≥" : "limit ≤"} ${a.dailyTargetMg} ${a.unit}/day. Food tip: ${a.amberTip}`);
    }
  }
  if (!lines.length) return "";
  return `\n━━ ACTIVE MICRONUTRIENT PRIORITIES ━━\nPrioritise meals that address these targets (from user's health conditions):\n${lines.join("\n")}`;
}

function buildCountryBlock(country?: string): string {
  const rule = COUNTRY_PROMPT[country ?? "OTHER"] ?? COUNTRY_PROMPT["OTHER"];
  return `\n━━ NUTRITIONAL GUIDELINES ━━\n${rule}`;
}

function buildFamilyBlock(familyRestrictions?: Record<string, any>): string {
  if (!familyRestrictions) return "";
  const r = familyRestrictions;
  const lines = [
    `Cooking for household: ${fmtList(r.memberNames)}`,
    `Combined dietary restrictions: ${fmtList(r.restrictions)}`,
    `Combined allergies (NEVER include): ${fmtList(r.allergies)}`,
    `Combined health conditions: ${fmtList(r.conditions)}`,
  ];
  if (r.hasConflictingConditions && r.conflictNote) {
    lines.push(`⚠ Note: ${r.conflictNote} — suggest the safest balanced option.`);
  }
  return `\n━━ FAMILY / HOUSEHOLD MODE ━━\n${lines.join("\n")}`;
}

function buildSystemPrompt(
  profile: Record<string, any>,
  totals: Record<string, number>,
  remaining: Record<string, number>,
  todayMealNames: string[],
  training: string,
  recentlyRecommended: string[],
  currentHour: number,
  familyMode: boolean,
  familyRestrictions?: Record<string, any>,
): string {
  const p = profile ?? {};

  console.log("[recommend-meals] restrictions:", {
    restrictions: p.restrictions,
    allergies: p.allergies,
    conditions: p.conditions,
    country: p.country,
    familyMode,
  });

  const effectiveProfile = familyMode && familyRestrictions ? familyRestrictions : p;

  return `CRITICAL DIETARY RESTRICTIONS — YOU MUST NEVER VIOLATE THESE:
${fmtList(effectiveProfile.restrictions)}

CRITICAL FOOD ALLERGIES — NEVER INCLUDE THESE INGREDIENTS:
${fmtList(effectiveProfile.allergies)}

CRITICAL HEALTH CONDITIONS — ADAPT ALL RECOMMENDATIONS:
${fmtList(effectiveProfile.conditions)}

If VEGETARIAN is listed above: every suggestion must contain zero meat, zero poultry, zero fish, zero seafood.
If VEGAN is listed above: every suggestion must contain zero animal products including dairy and eggs.
If GLUTEN-FREE is listed above: no wheat, no pasta, no bread, no barley, no rye.
If NO DAIRY is listed above: no milk, no cheese, no yoghurt, no butter, no cream.
If HALAL is listed above: no pork or non-halal meat.
If ENDOMETRIOSIS is listed above: avoid red meat and processed foods, prioritise anti-inflammatory ingredients.
If DIABETES is listed above: never suggest high-sugar foods, white bread, sugary drinks, or high-GI foods.
If HYPERTENSION is listed above: never suggest high-sodium foods. Keep sodium under 600 mg per meal.
If HIGH CHOLESTEROL is listed above: avoid saturated fats, prioritise fibre and lean protein.
If CELIAC is listed above: never suggest gluten in any form.
If KIDNEY DISEASE is listed above: limit potassium, phosphorus, protein, and sodium — every meal.
${familyMode ? buildFamilyBlock(familyRestrictions) : ""}
USER PROFILE:
Name: ${p.name || "User"}
Age: ${p.age || "unknown"} | Sex: ${p.sex || "unknown"}
Height: ${p.height || "unknown"} | Weight: ${p.weight || "unknown"}
Activity level: ${p.activityLevel || "unknown"}
Goals: ${fmtList(p.goals)}
Foods to avoid: ${fmtList(p.dislikes)}
Training types: ${fmtList(p.trainingTypes)}
Training today: ${training || "None"}

TODAY'S REMAINING NEEDS:
Calories: ${Math.round(remaining.calories || 0)} kcal | Protein: ${Math.round(remaining.protein || 0)}g | Carbs: ${Math.round(remaining.carbs || 0)}g | Fat: ${Math.round(remaining.fat || 0)}g | Fibre: ${Math.round(remaining.fiber || 0)}g
Current time: ${currentHour}:00 — before 11am suggest breakfast, 11am–3pm lunch, 3–6pm snack, after 6pm dinner

MEALS ALREADY LOGGED TODAY — DO NOT SUGGEST ANYTHING SIMILAR:
${todayMealNames.length ? todayMealNames.join(", ") : "None"}

MEALS SUGGESTED IN THE LAST 7 DAYS — DO NOT REPEAT:
${recentlyRecommended.length ? recentlyRecommended.join(", ") : "None"}
${buildConditionAlertsBlock(effectiveProfile.conditions ?? [])}
${buildCountryBlock(p.country)}

RULES:
- Never repeat a meal from the last 7 days or already logged today
- All 3 suggestions must use genuinely different protein sources and cuisines
- If training was logged, at least one suggestion must be high in protein
- Before finalising each suggestion, verify it against EVERY restriction above. If it contains any restricted ingredient, replace it immediately.

YOUR TASK:
Suggest exactly 3 specific meals for ${p.name || "this user"}. Be specific with ingredients.

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
    "restriction_badges": ["array of strings — list each specific restriction respected e.g. Vegetarian, Gluten-free. Never use generic badges."]
  }
]`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

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
      familyMode,
      familyRestrictions,
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
        typeof currentHour === "number" ? currentHour : new Date().getHours(),
        Boolean(familyMode),
        familyRestrictions,
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
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
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
    } catch {
      // Retry once with explicit JSON instruction
      console.warn("[recommend-meals] JSON parse failed, retrying...");
      const retry = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            { role: "user",      content: "Generate my 3 personalized meal recommendations now. Return JSON only." },
            { role: "assistant", content: raw },
            { role: "user",      content: "Your previous response was not valid JSON. Reply ONLY with the JSON array, no other text." },
          ],
        }),
      });
      if (retry.ok) {
        const retryData = await retry.json();
        const retryRaw: string = retryData?.content?.[0]?.text ?? "";
        const retryArr = retryRaw.match(/\[[\s\S]*\]/);
        try { parsed = JSON.parse(retryArr ? retryArr[0] : retryRaw); } catch { /* fall through */ }
      }
      if (!parsed) {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const arr = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? []);
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
        : s.suitable_for ? [String(s.suitable_for)] : [],
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
