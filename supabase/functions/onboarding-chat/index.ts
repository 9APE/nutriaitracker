// AI-driven onboarding via Anthropic Claude.
// Two modes:
//   mode: "chat"   -> conversational profile collection (returns assistant message)
//   mode: "goals"  -> compute personalised macro targets from a profile JSON
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_SYSTEM = `You are Nouri, a warm, friendly, and knowledgeable personal nutrition assistant. Your job right now is to onboard a new user by having a natural conversation with them. Your tone is calm, supportive, and approachable — like a knowledgeable friend, not a clinical form.

Your goal is to collect the following information through natural conversation, one topic at a time. Never ask more than one question per message. Wait for the user to reply before continuing.

Information to collect:
- First name
- Age
- Height and weight
- Biological sex (explain it helps estimate metabolism)
- Main health or fitness goals
- Any medical conditions (diabetes, blood pressure, cholesterol, thyroid, etc.)
- Dietary restrictions or preferences (vegetarian, vegan, halal, kosher, gluten-free, dairy-free, etc.)
- Activity level (sedentary, lightly active, moderately active, very active)
- Foods they strongly dislike or never eat
- Any food allergies

Start by warmly greeting the user and asking for their first name. Be conversational and natural. Use their name once you have it. Show empathy if they mention health conditions. Keep each message short — maximum 2-3 sentences.

Once you have collected ALL of the above information, end the conversation with exactly this JSON block and nothing else after it:

[PROFILE_COMPLETE]
{"name": "", "age": 0, "height": "", "weight": "", "sex": "", "goals": "", "conditions": [], "restrictions": [], "activityLevel": "", "dislikes": [], "allergies": []}`;

const GOALS_SYSTEM = (profileJson: string) => `You are a certified nutritionist AI. Based on the user profile below, calculate their personalised daily nutrition targets using the Mifflin-St Jeor equation for BMR, adjusted for their activity level and goals. Consider medical conditions carefully (e.g. lower carbs and sugar for diabetics, higher protein for muscle building, caloric deficit for weight loss, caloric surplus for bulking).

User profile: ${profileJson}

Return ONLY a valid JSON object with no extra text:

{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "reasoning": "2-3 sentences explaining why these numbers were chosen",
  "warnings": ["list of things to avoid based on their conditions and goals"]
}`;

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
    const mode = body?.mode ?? "chat";
    const lang = resolveLanguage(body?.language);

    if (mode === "chat") {
      const history = Array.isArray(body?.messages) ? body.messages : [];
      // If history is empty, send a single nudge so Claude produces the opening message.
      const messages =
        history.length === 0
          ? [{ role: "user", content: "Hi" }]
          : history;

      const text = await callClaude(ANTHROPIC_API_KEY, CHAT_SYSTEM + lang.suffix, messages);

      // Detect completion marker
      const completeIdx = text.indexOf("[PROFILE_COMPLETE]");
      let profile: any = null;
      let visible = text;
      if (completeIdx >= 0) {
        const after = text.slice(completeIdx + "[PROFILE_COMPLETE]".length);
        profile = extractJson(after);
        visible = text.slice(0, completeIdx).trim();
      }

      return new Response(
        JSON.stringify({ message: visible, complete: !!profile, profile }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "goals") {
      const profile = body?.profile;
      if (!profile) {
        return new Response(JSON.stringify({ error: "profile required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await callClaude(
        ANTHROPIC_API_KEY,
        GOALS_SYSTEM(JSON.stringify(profile)) + lang.suffix,
        [{ role: "user", content: "Calculate the targets now." }]
      );
      const parsed = extractJson(text);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: "Failed to parse plan", raw: text }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const plan = {
        calories: Math.round(Number(parsed.calories) || 0),
        protein: Math.round(Number(parsed.protein) || 0),
        carbs: Math.round(Number(parsed.carbs) || 0),
        fat: Math.round(Number(parsed.fat) || 0),
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      };
      return new Response(JSON.stringify({ plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("onboarding-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
