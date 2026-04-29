// Analyze a meal description with Anthropic Claude using the user's personalized profile
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
Health conditions: ${fmtList(p.healthConditions)}
Dietary restrictions: ${fmtList(p.dietaryRestrictions)}
Activity level: ${fmtList(p.activityLevel)}
Foods they eat regularly: ${fmtList(p.regularFoods)}
Foods they dislike: ${fmtList(p.dislikedFoods)}

Daily targets: ${goals.protein}g protein, ${goals.calories} kcal, ${goals.carbs}g carbs, ${goals.fat}g fat

Already eaten today:
${mealsList}

Remaining today: ${remaining.protein}g protein, ${remaining.calories} kcal

Today's date is ${opts.today}.

When the user describes a meal, estimate accurate macros based on the quantities given. Return ONLY valid JSON: {meal_name, type, calories, protein, carbs, fat, date, tip} where 'type' is one of Breakfast/Lunch/Dinner/Snack, 'date' is YYYY-MM-DD (default to today), and 'tip' is one short personalized sentence — either confirming this fits their goals, flagging a concern, or suggesting a small adjustment. Keep the tip friendly and concise.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { text, profile, goals, eatenToday } = body ?? {};

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

    const system = buildSystemPrompt({
      profile: profile && typeof profile === "object" ? profile : null,
      goals: safeGoals,
      eatenToday: safeEaten,
      today,
    });

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
        JSON.stringify({ error: "AI request failed", details: errText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Failed to parse AI response", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    };

    return new Response(JSON.stringify({ meal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-meal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
