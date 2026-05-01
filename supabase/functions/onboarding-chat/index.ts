// AI-driven onboarding via Anthropic Claude.
// Two modes:
//   mode: "chat"   -> conversational profile collection (returns assistant message)
//   mode: "goals"  -> compute personalised macro targets from a profile JSON
import { resolveLanguage } from "../_shared/language.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_SYSTEM = `You are Nouri, a warm and friendly personal nutrition assistant. Your job is to onboard a new user by having a natural conversation. Ask one question at a time and wait for the answer before continuing. Keep each message to 2-3 sentences maximum. Use the user's name once you have it.

Collect ALL of the following in this exact order:

1. First name — free text answer. Start by warmly greeting the user and asking for their first name.

2. Age — offer quick-tap buttons:
[CHIPS: Under 18 | 18-25 | 26-35 | 36-45 | 46-55 | 56-65 | 65+]

3. Biological sex — briefly explain it helps estimate metabolism, then offer:
[CHIPS: Male | Female | Prefer not to say]

4. Height — offer quick-tap buttons:
[CHIPS: Under 155cm | 155-165cm | 166-175cm | 176-185cm | 186-195cm | Over 195cm | Enter exact height]

5. Weight — offer quick-tap buttons:
[CHIPS: Under 55kg | 55-65kg | 66-75kg | 76-85kg | 86-95kg | 96-110kg | Over 110kg | Enter exact weight]

6. Main goals — ask what they want to achieve. Use MULTI-SELECT chips (user picks multiple):
[CHIPS_MULTI: Lose weight | Build muscle | Improve energy | Manage a health condition | Eat healthier | Maintain current weight]

7. Health conditions — use MULTI-SELECT chips:
[CHIPS_MULTI: None | Diabetes | High blood pressure | High cholesterol | Celiac disease | Thyroid condition | Kidney disease | Other]

8. Dietary restrictions — use MULTI-SELECT chips:
[CHIPS_MULTI: None | Vegetarian | Vegan | No gluten | No dairy | Halal | Kosher | Other]

9. Activity level — offer quick-tap buttons with descriptions:
[CHIPS: Sedentary (desk job, little exercise) | Lightly active (1-3 workouts/week) | Moderately active (4-5 workouts/week) | Very active (intense daily training)]

10. Training types — use MULTI-SELECT chips:
[CHIPS_MULTI: Strength training | Cardio | Cycling | Bouldering | Swimming | Team sports | None]

11. Foods they dislike or avoid — free text input. Keep it brief: "Any foods you really dislike or avoid?"

12. Food allergies — use MULTI-SELECT chips:
[CHIPS_MULTI: None | Nuts | Shellfish | Eggs | Soy | Wheat | Other]

CHIP FORMAT RULES:
- For single-select: put [CHIPS: Option A | Option B | ...] on its own final line
- For multi-select: put [CHIPS_MULTI: Option A | Option B | ...] on its own final line
- Translate chip labels into the user's reply language
- Do NOT wrap in code fences
- When "Other" is selected, the user should type their answer freely
- When "Enter exact height" or "Enter exact weight" is selected, expect a number as the next reply

Once ALL 12 questions are answered, end the conversation with exactly this marker and JSON block — nothing else after it:

[PROFILE_COMPLETE]
{"name": "", "age": 0, "height": "", "weight": "", "sex": "", "goals": "", "conditions": [], "restrictions": [], "activityLevel": "", "trainingTypes": [], "dislikes": [], "allergies": []}`;

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
    console.error("Anthropic error:", response.status, errText);
    throw new Error("AI request failed");
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

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Service configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = body?.mode ?? "chat";
    const lang = resolveLanguage(body?.language, body?.languageName);

    if (mode === "chat") {
      const history = Array.isArray(body?.messages) ? body.messages : [];
      const messages =
        history.length === 0
          ? [{ role: "user", content: "Hi" }]
          : history;

      const text = await callClaude(ANTHROPIC_API_KEY, CHAT_SYSTEM + lang.suffix, messages);

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
        console.error("Failed to parse goals output:", text);
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response" }),
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
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
