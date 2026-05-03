// NutriAI Chat — Claude-powered nutrition Q&A with research citations, country guidelines, and family mode
import { resolveLanguage } from "../_shared/language.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function fmtList(v: unknown, fallback = "None"): string {
  if (Array.isArray(v) && v.length) return v.join(", ");
  if (typeof v === "string" && v.trim()) return v;
  return fallback;
}

function buildSystemPrompt(
  profile: Record<string, any>,
  goals: Record<string, number>,
  todayMeals: any[],
  languageName: string,
  familyMode: boolean,
  familyRestrictions?: Record<string, any>,
): string {
  const p = profile ?? {};

  const totals = todayMeals.reduce(
    (a: any, m: any) => ({
      calories: a.calories + (m.calories || 0),
      protein: a.protein + (m.protein || 0),
      carbs: a.carbs + (m.carbs || 0),
      fat: a.fat + (m.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const remaining = {
    calories: Math.max(0, (goals.calories || 0) - totals.calories),
    protein: Math.max(0, (goals.protein || 0) - totals.protein),
    carbs: Math.max(0, (goals.carbs || 0) - totals.carbs),
    fat: Math.max(0, (goals.fat || 0) - totals.fat),
  };

  const mealsSummary = todayMeals.length
    ? todayMeals.map((m: any) => `  • ${m.meal_name} — ${m.calories} kcal, ${m.protein}g P`).join("\n")
    : "  Nothing logged yet today.";

  const countryRule = COUNTRY_PROMPT[p.country ?? "OTHER"] ?? COUNTRY_PROMPT["OTHER"];

  const familyBlock = familyMode && familyRestrictions
    ? `\n━━ FAMILY / HOUSEHOLD MODE ━━
Cooking for household: ${fmtList(familyRestrictions.memberNames)}
Combined dietary restrictions: ${fmtList(familyRestrictions.restrictions)}
Combined allergies (NEVER recommend): ${fmtList(familyRestrictions.allergies)}
Combined health conditions: ${fmtList(familyRestrictions.conditions)}
${familyRestrictions.hasConflictingConditions ? `⚠ Note: ${familyRestrictions.conflictNote} — give balanced advice.` : ""}`
    : "";

  return `You are NutriAI, a personal nutrition coach. You give warm, evidence-based nutritional guidance tailored specifically to this user.

━━ USER PROFILE ━━
Name: ${p.name || "User"}
Age: ${p.age || "unknown"} | Sex: ${p.sex || "unknown"}
Height: ${p.height || "unknown"} | Weight: ${p.weight || "unknown"}
Activity level: ${p.activityLevel || "unknown"}
Health goals: ${fmtList(p.goals)}
Health conditions: ${fmtList(p.conditions)}
Dietary restrictions: ${fmtList(p.restrictions)}
Food allergies: ${fmtList(p.allergies)}
Foods to avoid: ${fmtList(p.dislikes)}
Food preferences: ${fmtList(p.preferences)}
${familyBlock}
━━ TODAY'S NUTRITION TARGETS ━━
Calories: ${goals.calories || 0} kcal | Protein: ${goals.protein || 0}g | Carbs: ${goals.carbs || 0}g | Fat: ${goals.fat || 0}g

━━ TODAY'S MEALS LOGGED ━━
${mealsSummary}

Consumed: ${Math.round(totals.calories)} kcal | ${Math.round(totals.protein)}g P | ${Math.round(totals.carbs)}g C | ${Math.round(totals.fat)}g F
Remaining: ${Math.round(remaining.calories)} kcal | ${Math.round(remaining.protein)}g P | ${Math.round(remaining.carbs)}g C | ${Math.round(remaining.fat)}g F

━━ NUTRITIONAL GUIDELINES AUTHORITY ━━
${countryRule}

━━ RULES ━━
1. Always tailor answers to this user's specific profile, conditions, restrictions, and remaining nutrition needs.
2. For every response, include 2–3 real citations from trusted sources: PubMed (https://pubmed.ncbi.nlm.nih.gov/[PMID]/), WHO (https://www.who.int/...), NHS (https://www.nhs.uk/...), ADA (https://diabetes.org/...), Mayo Clinic (https://www.mayoclinic.org/...), NIH ODS (https://ods.od.nih.gov/...). Only cite URLs you are confident exist.
3. If the user has a health condition, reference condition-specific guidelines.
4. Never diagnose or replace a medical professional. For medical questions, always recommend consulting their doctor.
5. Be warm, specific, and concise.
6. If the user expresses a food preference, restriction, allergy, or dislike in their message, acknowledge it warmly and confirm it has been noted for future recommendations.
7. Always reply in ${languageName}.
8. Keep responses to 6 chat messages of context maximum — be concise.

━━ RESPONSE FORMAT ━━
You MUST return valid JSON only — no markdown fences, no extra text:
{
  "answer": "your full response here",
  "sources": [
    { "title": "Source name", "url": "https://..." },
    { "title": "Source name", "url": "https://..." }
  ]
}`;
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      messages,
      profile,
      goals,
      todayMeals,
      language,
      languageName,
      familyMode,
      familyRestrictions,
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lang = resolveLanguage(language, languageName);
    const systemPrompt = buildSystemPrompt(
      profile ?? {},
      goals ?? {},
      todayMeals ?? [],
      lang.name,
      Boolean(familyMode),
      familyRestrictions,
    );

    // Send last 6 messages for context (token optimisation)
    const historyToSend = messages.slice(-6).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    }));

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
        messages: historyToSend,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const raw: string = data?.content?.[0]?.text ?? "";

    let parsed: { answer: string; sources: { title: string; url: string }[] };
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { answer: raw, sources: [] };
    }

    const citations = (parsed.sources ?? [])
      .filter((s) => s?.url)
      .map((s) => ({ title: s.title || s.url, url: s.url }));

    return new Response(
      JSON.stringify({ content: parsed.answer || raw, citations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("nutrition-chat error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
