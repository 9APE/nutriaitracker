// Weekly check-in chat with Nouri (Claude Sonnet)
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function buildSystem(
  goals: Goals,
  avgProtein: number,
  avgCalories: number,
  profile: any,
) {
  return `You are Nouri, a warm and supportive nutrition assistant AND a clinical nutritionist. The user has been tracking for a week.

Current daily goals: ${JSON.stringify(goals)}
User profile: ${JSON.stringify(profile ?? {})}
Average protein this week: ${Math.round(avgProtein)}g
Average calories this week: ${Math.round(avgCalories)} kcal

Have a short friendly check-in. Ask ONE question at a time, wait for their reply before the next. Keep each message to 1-3 sentences.

Cover these in order:
1. How are they feeling this week overall?
2. Did the calorie and protein targets feel too high, too low, or about right?
3. Any changes to their activity, training frequency, or goals?

After all 3 answers:
- Re-run a full personalized recalculation using Mifflin-St Jeor (BMR x activity multiplier, goal-adjusted) for ALL macros and micronutrients
- If user said "too high" reduce that macro by 5-10%; "too low" increase by 5-10%; "about right" keep within 2%
- Keep carbs and fat proportional to calories unless the user said otherwise
- Personalize micronutrients to their profile (sex, age, conditions): Sodium 1500mg if hypertension else 2300mg; Iron 18mg female / 8mg male / up to 20mg athlete; Calcium 1200mg if 50+ else 1000mg; Vitamin D 15-25µg; Fiber 14g per 1000 kcal; Sugar max 25g if diabetic/weight-loss else 50g; Saturated fat = 10% of calories / 9; Cholesterol 200mg if high cholesterol else 300mg

When ready, send your final message ending with EXACTLY this marker on its own line followed by a JSON object:

[CHECKIN_COMPLETE]
{"calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number>, "sugar_max": <number>, "saturated_fat_max": <number>, "sodium_max": <number>, "cholesterol_max": <number>, "potassium": <number>, "calcium": <number>, "iron": <number>, "vitamin_c": <number>, "vitamin_d": <number>, "vitamin_a": <number>, "summary": "<one encouraging sentence summarizing the new protein and calorie targets>"}

Do not include the marker or JSON before all 3 questions are answered.`;
}

async function callClaude(apiKey: string, system: string, messages: any[]) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system,
      messages,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText}`);
  }
  const data = await response.json();
  return (data?.content?.[0]?.text ?? "") as string;
}

function extractJson(raw: string): any | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const obj = s.match(/\{[\s\S]*\}/);
  if (obj) s = obj[0];
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const goals: Goals = body?.goals ?? { calories: 2000, protein: 120, carbs: 200, fat: 70 };
    const avgProtein = Number(body?.avgProtein ?? 0);
    const avgCalories = Number(body?.avgCalories ?? 0);
    const history = Array.isArray(body?.messages) ? body.messages : [];

    const messages =
      history.length === 0 ? [{ role: "user", content: "Hi" }] : history;

    const lang = resolveLanguage(body?.language, body?.languageName);
    const text = await callClaude(
      ANTHROPIC_API_KEY,
      buildSystem(goals, avgProtein, avgCalories) + lang.suffix,
      messages
    );

    const idx = text.indexOf("[CHECKIN_COMPLETE]");
    let visible = text;
    let result: any = null;
    if (idx >= 0) {
      const after = text.slice(idx + "[CHECKIN_COMPLETE]".length);
      const parsed = extractJson(after);
      if (parsed) {
        result = {
          calories: Math.round(Number(parsed.calories) || goals.calories),
          protein: Math.round(Number(parsed.protein) || goals.protein),
          carbs: Math.round(Number(parsed.carbs) || goals.carbs),
          fat: Math.round(Number(parsed.fat) || goals.fat),
          summary: typeof parsed.summary === "string" ? parsed.summary : "Great work this week!",
        };
        visible = text.slice(0, idx).trim();
      }
    }

    return new Response(
      JSON.stringify({ message: visible, complete: !!result, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("weekly-checkin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
