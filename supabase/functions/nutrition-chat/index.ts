// NutriAI Chat — Perplexity-powered nutrition Q&A with live research citations
import { resolveLanguage } from "../_shared/language.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

━━ TODAY'S NUTRITION TARGETS ━━
Calories: ${goals.calories || 0} kcal | Protein: ${goals.protein || 0}g | Carbs: ${goals.carbs || 0}g | Fat: ${goals.fat || 0}g

━━ TODAY'S MEALS LOGGED ━━
${mealsSummary}

Consumed: ${Math.round(totals.calories)} kcal | ${Math.round(totals.protein)}g P | ${Math.round(totals.carbs)}g C | ${Math.round(totals.fat)}g F
Remaining: ${Math.round(remaining.calories)} kcal | ${Math.round(remaining.protein)}g P | ${Math.round(remaining.carbs)}g C | ${Math.round(remaining.fat)}g F

━━ RULES ━━
1. Always tailor answers to this user's specific profile, conditions, restrictions, and remaining nutrition needs.
2. Every response MUST end with numbered sources — real research papers or authoritative health organisation pages.
3. If the user has a health condition (e.g. diabetes, hypertension), reference condition-specific guidelines (ADA, NHS, WHO).
4. Never diagnose or replace a medical professional. For medical questions, always recommend consulting their doctor.
5. Be warm, specific, and concise — avoid generic advice.
6. Always reply in ${languageName}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Perplexity API key not configured. Add PERPLEXITY_API_KEY to Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages, profile, goals, todayMeals, language, languageName } = await req.json();

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
    );

    // Send last 10 messages for context (keeps costs manageable)
    const historyToSend = messages.slice(-10).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    }));

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyToSend,
        ],
        max_tokens: 1024,
        temperature: 0.2,
        search_domain_filter: [
          "pubmed.ncbi.nlm.nih.gov",
          "nih.gov",
          "who.int",
          "nhs.uk",
          "diabetes.org",
          "mayoclinic.org",
          "nutrition.org",
          "heart.org",
          "dietitians.ca",
          "nutrition.gov",
        ],
        return_images: false,
        return_related_questions: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : [];

    return new Response(
      JSON.stringify({ content, citations }),
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
