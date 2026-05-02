// Analyze a meal description with Anthropic Claude using the user's personalized profile
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

function buildSystemPrompt(opts: {
  profile: Record<string, any> | null;
  goals: { calories: number; protein: number; carbs: number; fat: number };
  eatenToday: {
    totals: { calories: number; protein: number; carbs: number; fat: number };
    meals: Array<{
      meal_name: string;
      type: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  };
  today: string;
}) {
  const p = opts.profile ?? {};
  const goals = opts.goals;
  const eaten = opts.eatenToday.totals;
  const remaining = {
    calories: Math.max(0, (goals.calories || 0) - (eaten.calories || 0)),
    protein: Math.max(0, (goals.protein || 0) - (eaten.protein || 0)),
    carbs: Math.max(0, (goals.carbs || 0) - (eaten.carbs || 0)),
    fat: Math.max(0, (goals.fat || 0) - (eaten.fat || 0)),
  };

  const mealsList =
    opts.eatenToday.meals.length === 0
      ? "nothing yet"
      : opts.eatenToday.meals
          .map(
            (m) =>
              `- ${m.meal_name} (${m.type}): ${m.calories} kcal, ${m.protein}g P, ${m.carbs}g C, ${m.fat}g F`
          )
          .join("\n");

  return `You are a personalized nutrition AI called Nouri. Here is the user's profile:

Goals: ${fmtList(p.goals)}
Health conditions: ${fmtList(p.conditions)}
Dietary restrictions: ${fmtList(p.restrictions)}
Activity level: ${fmtList(p.activityLevel)}
Foods they eat regularly: ${fmtList(p.regularFoods)}
Foods they dislike: ${fmtList(p.dislikedFoods)}

Daily targets: ${goals.protein}g protein, ${goals.calories} kcal, ${goals.carbs}g carbs, ${goals.fat}g fat

Already eaten today:
${mealsList}

Remaining today: ${remaining.protein}g protein, ${remaining.calories} kcal

Today's date is ${opts.today}.

When the user describes a meal, first check if they gave specific quantities (grams, cups, pieces, handfuls etc).

If quantities ARE specific enough: parse normally and return ONLY valid JSON with EVERY one of these keys present (no extras, no omissions):
{meal_name, type, date, calories, protein, carbs, fat, fiber, sugar, saturated_fat, sodium, potassium, cholesterol, vitamin_c, vitamin_d, vitamin_a, calcium, iron, tip}
where:
- 'type' is one of Breakfast/Lunch/Dinner/Snack
- 'date' is YYYY-MM-DD (default to today)
- 'tip' is one short personalized sentence — either confirming this fits their goals, flagging a concern, or suggesting a small adjustment. Keep it friendly and concise.
- All nutrient fields are numbers for the FULL meal (not per 100g) using these units:
  calories (kcal), protein/carbs/fat/fiber/sugar/saturated_fat (g),
  sodium/potassium/cholesterol/iron/vitamin_c/calcium (mg),
  vitamin_d/vitamin_a (µg).
  ALWAYS include every nutrient field. If a value is genuinely negligible (e.g. vitamin C in plain butter), use 0 — never omit. Use rounded whole numbers. Estimates are fine — they will be displayed as approximate daily totals.

If quantities are TOO vague (e.g. 'I had chicken and rice', 'I had pasta', 'I had a salad'): do NOT estimate yet. Instead return ONLY valid JSON: {"type": "clarification", "question": "one short friendly question asking for the most important missing quantity", "options": ["option 1", "option 2", "option 3"]}. Always offer 2-3 short tappable options so the user doesn't have to think. Examples of question + options:
- question: "How much chicken roughly?" options: ["Small (~100g)", "Medium (~150g)", "Large (200g+)"]
- question: "Was it a small bowl of pasta or a big one?" options: ["Small bowl (~80g dry)", "Medium (~120g dry)", "Big bowl (~180g dry)"]

Ask only ONE question, for the single most impactful missing info. If the user has already been asked once and answers vaguely again, make a reasonable estimate and proceed with the normal meal JSON — never ask twice.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard
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

    const body = await req.json();
    const { text, profile, goals, eatenToday, warnings, alreadyClarified, language, languageName } = body ?? {};
    const lang = resolveLanguage(language, languageName);

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Meal description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const safeGoals = {
      calories: Number(goals?.calories) || 2500,
      protein: Number(goals?.protein) || 150,
      carbs: Number(goals?.carbs) || 200,
      fat: Number(goals?.fat) || 70,
    };
    const safeEaten = {
      totals: {
        calories: Number(eatenToday?.totals?.calories) || 0,
        protein: Number(eatenToday?.totals?.protein) || 0,
        carbs: Number(eatenToday?.totals?.carbs) || 0,
        fat: Number(eatenToday?.totals?.fat) || 0,
      },
      meals: Array.isArray(eatenToday?.meals) ? eatenToday.meals : [],
    };
    const safeWarnings: string[] = Array.isArray(warnings) ? warnings.map(String) : [];

    let system = buildSystemPrompt({
      profile: profile && typeof profile === "object" ? profile : null,
      goals: safeGoals,
      eatenToday: safeEaten,
      today,
    });
    if (safeWarnings.length > 0) {
      system += `\n\nImportant things to watch for this user:\n${safeWarnings.map((w) => `- ${w}`).join("\n")}`;
    }
    if (alreadyClarified) {
      system += `\n\nYou already asked the user one clarifying question. Do NOT ask again — make a reasonable estimate now and return the normal meal JSON.`;
    }
    system += EVIDENCE_SOURCES_INSTRUCTION;
    system += lang.suffix;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: text }],
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
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

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

    if (parsed?.type === "clarification" && !alreadyClarified) {
      const clarification = {
        type: "clarification" as const,
        question: String(parsed.question ?? "Could you give me a rough quantity?"),
        options: Array.isArray(parsed.options)
          ? parsed.options.slice(0, 3).map(String)
          : [],
      };
      return new Response(JSON.stringify({ clarification }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MICRO_KEYS = [
      "fiber", "sugar", "saturated_fat", "sodium", "potassium",
      "cholesterol", "iron", "vitamin_c", "vitamin_d", "vitamin_a", "calcium",
    ] as const;
    const flatSource = parsed && typeof parsed === "object" ? parsed : {};
    const nestedSource =
      parsed && typeof parsed.micros === "object" && parsed.micros ? parsed.micros : {};
    const micros: Record<string, number> = {};
    for (const k of MICRO_KEYS) {
      const raw = (flatSource as any)[k] ?? (nestedSource as any)[k];
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) micros[k] = Math.round(v * 10) / 10;
    }

    const meal = {
      meal_name: String(parsed.meal_name ?? "Meal"),
      type: ["Breakfast", "Lunch", "Dinner", "Snack"].includes(parsed.type)
        ? parsed.type
        : "Snack",
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round(Number(parsed.protein) || 0),
      carbs: Math.round(Number(parsed.carbs) || 0),
      fat: Math.round(Number(parsed.fat) || 0),
      date: typeof parsed.date === "string" ? parsed.date : today,
      tip: typeof parsed.tip === "string" ? parsed.tip : undefined,
      micros,
    };

    return new Response(JSON.stringify({ meal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-meal error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
