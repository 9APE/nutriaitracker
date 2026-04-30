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

function buildSystem(goals: Goals, avgProtein: number, avgCalories: number) {
  return `You are Nouri, a warm and supportive nutrition assistant. The user has been tracking for a week. Current goals: ${JSON.stringify(goals)}. Their average protein this week: ${Math.round(avgProtein)}g, average calories: ${Math.round(avgCalories)} kcal.

Have a short friendly check-in. Ask ONE question at a time, wait for their reply before the next. Keep each message to 1-3 sentences.

Cover these in order:
1. How are they feeling this week overall?
2. Did the calorie and protein targets feel too high, too low, or about right?
3. Any changes to their activity or goals?

Based on their answers, adjust the targets:
- "too high" => reduce that macro by 5-10%
- "too low" => increase by 5-10%
- "about right" => keep the same
Keep carbs and fat proportional to calories unless the user said otherwise.

When you have all 3 answers, send your final message ending with EXACTLY this marker on its own line followed by a JSON object:

[CHECKIN_COMPLETE]
{"calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "summary": "<one encouraging sentence>"}

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

    const lang = resolveLanguage(body?.language);
    const text = await callClaude(
      ANTHROPIC_API_KEY,
      lang.prefix + buildSystem(goals, avgProtein, avgCalories),
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
