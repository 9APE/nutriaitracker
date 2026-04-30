// Suggest meals tailored to remaining macros for the day
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a friendly nutrition coach. Given a user's daily macro goals, what they've already eaten today, and the upcoming meal type (Breakfast/Lunch/Dinner/Snack), suggest exactly 3 realistic meal ideas that help them hit their remaining macros.

Return ONLY a JSON object with this shape:
{
  "suggestions": [
    {
      "meal_name": "string (concise, appetizing)",
      "description": "string (one short sentence about ingredients)",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ]
}

Aim each suggestion at roughly 1/3 of the remaining calories (or appropriate portion for the meal type). Prefer whole-food, balanced meals. Avoid repeating the same meals the user already logged today.`;

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

    const { goals, eatenToday, mealType, language } = await req.json();
    const lang = resolveLanguage(language);

    if (!goals || !mealType) {
      return new Response(
        JSON.stringify({ error: "goals and mealType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eaten = eatenToday ?? { calories: 0, protein: 0, carbs: 0, fat: 0, names: [] };
    const remaining = {
      calories: Math.max(0, (goals.calories || 0) - (eaten.calories || 0)),
      protein: Math.max(0, (goals.protein || 0) - (eaten.protein || 0)),
      carbs: Math.max(0, (goals.carbs || 0) - (eaten.carbs || 0)),
      fat: Math.max(0, (goals.fat || 0) - (eaten.fat || 0)),
    };

    const userMessage = `Upcoming meal: ${mealType}

Daily goals:
- Calories: ${goals.calories}
- Protein: ${goals.protein}g
- Carbs: ${goals.carbs}g
- Fat: ${goals.fat}g

Already eaten today:
- Calories: ${eaten.calories}
- Protein: ${eaten.protein}g
- Carbs: ${eaten.carbs}g
- Fat: ${eaten.fat}g
${eaten.names?.length ? `- Meals: ${eaten.names.join(", ")}` : ""}

Remaining for the rest of the day:
- Calories: ${remaining.calories}
- Protein: ${remaining.protein}g
- Carbs: ${remaining.carbs}g
- Fat: ${remaining.fat}g

Suggest 3 ${mealType.toLowerCase()} ideas to help hit these targets. Return JSON only.`;

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
        system: SYSTEM_PROMPT + lang.suffix,
        messages: [{ role: "user", content: userMessage }],
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

    const suggestions = (parsed.suggestions ?? []).slice(0, 3).map((s: any) => ({
      meal_name: String(s.meal_name ?? "Meal"),
      description: String(s.description ?? ""),
      calories: Math.round(Number(s.calories) || 0),
      protein: Math.round(Number(s.protein) || 0),
      carbs: Math.round(Number(s.carbs) || 0),
      fat: Math.round(Number(s.fat) || 0),
    }));

    return new Response(JSON.stringify({ suggestions, mealType, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-meals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
