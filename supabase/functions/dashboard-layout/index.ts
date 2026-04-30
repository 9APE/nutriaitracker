// Generate a personalized Today-tab dashboard layout via Claude.
// Returns { large, medium, small, banner, reasoning }.
import { resolveLanguage } from "../_shared/language.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AVAILABLE_METRICS = [
  "calories", "protein", "carbs", "sugar", "fat", "fiber",
  "sodium", "potassium", "cholesterol", "saturated_fat",
  "iron", "vitamin_c", "vitamin_d", "calcium",
] as const;

type Metric = typeof AVAILABLE_METRICS[number];

interface LayoutOut {
  large: Metric[];
  medium: Metric[];
  small: Metric[];
  banner: string;
  reasoning: string;
}

function buildSystem() {
  return `You are a clinical nutritionist AI. Based on the user profile provided, decide the visual priority order of nutrition metrics on their home dashboard. Your goal is to show the most medically and goal-relevant metrics most prominently.

Return ONLY a valid JSON object:
{
  "large": [array of up to 3 metric names — big prominent rings],
  "medium": [array of up to 3 metric names — medium cards],
  "small": [remaining metrics — collapsed by default],
  "banner": "one short motivational or warning sentence personalized to their condition and goals",
  "reasoning": "one sentence explaining why you prioritized these metrics"
}

Available metrics (use ONLY these exact keys): ${AVAILABLE_METRICS.join(", ")}.

Prioritize based on:
- Medical conditions: diabetes => sugar/carbs/fiber; hypertension => sodium/potassium; high cholesterol => saturated_fat/fiber/cholesterol; celiac => fiber/iron; kidney disease => sodium/potassium/protein; thyroid => iron/calcium (closest available proxies).
- Goals: weight loss => calories/protein/fiber; muscle gain => protein/calories/carbs; general health => balanced.
- If multiple conditions, MERGE priorities — never drop a critical metric for any active condition.
- ALWAYS include protein and calories somewhere (large or medium) — never fully hide them.
- Every metric from the available list must appear in exactly one of large/medium/small.`;
}

async function callClaude(apiKey: string, system: string, userContent: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
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
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic ${r.status}: ${t}`);
  }
  const data = await r.json();
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

function sanitize(parsed: any): LayoutOut {
  const seen = new Set<string>();
  const filterArr = (arr: any, max: number): Metric[] => {
    if (!Array.isArray(arr)) return [];
    const out: Metric[] = [];
    for (const v of arr) {
      const k = String(v).toLowerCase().trim();
      if ((AVAILABLE_METRICS as readonly string[]).includes(k) && !seen.has(k)) {
        seen.add(k);
        out.push(k as Metric);
        if (out.length >= max) break;
      }
    }
    return out;
  };
  const large = filterArr(parsed?.large, 3);
  const medium = filterArr(parsed?.medium, 3);
  // small = remaining
  const small: Metric[] = [];
  for (const m of AVAILABLE_METRICS) {
    if (!seen.has(m)) {
      seen.add(m);
      small.push(m);
    }
  }
  // Guarantee protein & calories visible
  const ensure = (m: Metric) => {
    if (large.includes(m) || medium.includes(m)) return;
    const i = small.indexOf(m);
    if (i >= 0) {
      small.splice(i, 1);
      if (medium.length < 3) medium.push(m);
      else if (large.length < 3) large.push(m);
      else medium[medium.length - 1] = m;
    }
  };
  ensure("protein");
  ensure("calories");

  return {
    large,
    medium,
    small,
    banner: typeof parsed?.banner === "string" ? parsed.banner : "Keep going — small steady choices add up.",
    reasoning: typeof parsed?.reasoning === "string" ? parsed.reasoning : "Balanced default layout.",
  };
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

    const body = await req.json().catch(() => ({}));
    const profile = body?.profile ?? {};
    const goals = body?.goals ?? null;
    const currentLayout = body?.currentLayout ?? null;
    const userMessage: string | undefined = body?.userMessage;
    const lang = resolveLanguage(body?.language, body?.languageName);

    const userContent = [
      `User profile: ${JSON.stringify(profile)}`,
      goals ? `Current daily targets: ${JSON.stringify(goals)}` : null,
      currentLayout ? `Current layout: ${JSON.stringify(currentLayout)}` : null,
      userMessage
        ? `The user just said: "${userMessage}"\nUpdate the layout to reflect what they want to focus on now.`
        : `Generate the initial personalized layout.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const system = buildSystem() + lang.suffix;
    const raw = await callClaude(ANTHROPIC_API_KEY, system, userContent);
    const parsed = extractJson(raw);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Failed to parse AI layout", raw }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const layout = sanitize(parsed);
    return new Response(JSON.stringify({ layout }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dashboard-layout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
