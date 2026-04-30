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

QUICK-REPLY CHIPS (very important):
Whenever your question has a small, well-known set of common answers, end your message with a chips line so the user can tap instead of typing. Format EXACTLY like this on its own final line:

[CHIPS: Option A | Option B | Option C]

Rules for chips:
- Use chips for: biological sex (Male | Female | Other), activity level (Sedentary | Lightly active | Moderately active | Very active), yes/no questions (Yes | No), common dietary restrictions (None | Vegetarian | Vegan | Halal | Kosher | Gluten-free | Dairy-free | Other), common allergies (None | Nuts | Dairy | Gluten | Shellfish | Eggs | Soy | Other), common medical conditions (None | Diabetes | High blood pressure | High cholesterol | Thyroid | Other), and similar closed-set questions.
- Do NOT use chips for open questions like name, age, height, weight, or "what are your goals?".
- When the answer set could be larger than your chips, ALWAYS include "Other" as the last chip so the user can type freely.
- Translate the chip labels into the user's reply language.
- Put the [CHIPS: …] line at the very end of your message, on its own line. Do not wrap it in code fences.

Once you have collected ALL of the above information, end the conversation with exactly this JSON block and nothing else after it:

[PROFILE_COMPLETE]
{"name": "", "age": 0, "height": "", "weight": "", "sex": "", "goals": "", "conditions": [], "restrictions": [], "activityLevel": "", "dislikes": [], "allergies": []}`;

const GOALS_SYSTEM = (profileJson: string) => `You are a clinical nutritionist. Based on the user profile below, calculate precise personalized daily nutrition targets using the Mifflin-St Jeor equation for BMR adjusted for activity level and goals. Factor in height, weight, age, sex, training frequency, and health conditions for every single value — not generic population averages.

User profile: ${profileJson}

Personalization rules:
- Calories: use Mifflin-St Jeor BMR x activity multiplier, then adjust for goal (deficit -15 to -20% for weight loss, surplus +10 to +15% for muscle gain)
- Protein: 1.6-2.2g per kg bodyweight for muscle gain or active users, 1.2-1.6g for weight loss, 0.8g for sedentary
- Sodium: lower limit (1500mg) for hypertension, standard (2300mg) for healthy users
- Iron: higher target for females (18mg), standard for males (8mg), higher for athletes (up to 20mg)
- Calcium: higher for users over 50 (1200mg), standard for adults (1000mg)
- Vitamin D: higher for users in low-sunlight regions or with deficiency noted in conditions (15-25µg)
- Fiber: scale with calorie intake — approximately 14g per 1000 kcal
- Sugar max: lower (25g) for diabetics or weight loss goals, standard (50g) for others
- Saturated fat: scale to 10% of total daily calories (in grams = calories*0.10/9)
- Cholesterol max: 200mg for high cholesterol, 300mg otherwise
- Potassium: 3500-4700mg adjusted for activity
- Vitamin C: 75mg female / 90mg male, +35mg if smoker
- Vitamin A: 700µg female / 900µg male

Return ONLY a valid JSON object with no extra text:

{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar_max": number,
  "saturated_fat_max": number,
  "sodium_max": number,
  "cholesterol_max": number,
  "potassium": number,
  "calcium": number,
  "iron": number,
  "vitamin_c": number,
  "vitamin_d": number,
  "vitamin_a": number,
  "reasoning": {
    "calories": "one sentence explaining the calorie target",
    "protein": "one sentence explaining the protein target",
    "carbs": "one sentence explaining the carb target",
    "fat": "one sentence explaining the fat target",
    "fiber": "one sentence explaining the fiber target",
    "sodium_max": "one sentence explaining the sodium limit",
    "iron": "one sentence explaining the iron target",
    "calcium": "one sentence explaining the calcium target",
    "vitamin_d": "one sentence explaining the vitamin D target"
  },
  "warnings": ["list of things to watch based on conditions and goals"]
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
    const lang = resolveLanguage(body?.language, body?.languageName);

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
      const numOrUndef = (v: any) => {
        const n = Number(v);
        return isFinite(n) ? Math.round(n) : undefined;
      };
      const plan: Record<string, any> = {
        calories: Math.round(Number(parsed.calories) || 0),
        protein: Math.round(Number(parsed.protein) || 0),
        carbs: Math.round(Number(parsed.carbs) || 0),
        fat: Math.round(Number(parsed.fat) || 0),
        fiber: numOrUndef(parsed.fiber),
        sugar_max: numOrUndef(parsed.sugar_max),
        saturated_fat_max: numOrUndef(parsed.saturated_fat_max),
        sodium_max: numOrUndef(parsed.sodium_max),
        cholesterol_max: numOrUndef(parsed.cholesterol_max),
        potassium: numOrUndef(parsed.potassium),
        calcium: numOrUndef(parsed.calcium),
        iron: numOrUndef(parsed.iron),
        vitamin_c: numOrUndef(parsed.vitamin_c),
        vitamin_d: numOrUndef(parsed.vitamin_d),
        vitamin_a: numOrUndef(parsed.vitamin_a),
        reasoning:
          parsed.reasoning && typeof parsed.reasoning === "object"
            ? parsed.reasoning
            : typeof parsed.reasoning === "string"
            ? { calories: parsed.reasoning }
            : {},
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
