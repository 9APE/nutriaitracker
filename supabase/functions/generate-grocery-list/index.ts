// NutriAI — Grocery list generator from weekly meal plan
// Uses claude-haiku for cost efficiency (no citations needed)
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPERMARKET_CATEGORIES = ["Produce", "Proteins", "Dairy & Eggs", "Grains & Bread", "Canned & Jarred", "Condiments & Spices", "Frozen", "Beverages", "Other"];

function buildSystemPrompt(householdSize: number, familyMembers: { name: string; restrictions: string[]; allergies: string[] }[]): string {
  const specialNotes = familyMembers.length > 1
    ? familyMembers
        .filter((m) => m.restrictions?.length || m.allergies?.length)
        .map((m) => `${m.name}: ${[...(m.restrictions ?? []), ...(m.allergies ?? []).map((a) => `no ${a}`)].join(", ")}`)
        .join("; ")
    : "";

  return `You are a grocery list assistant. Given a 7-day meal plan for ${householdSize} person(s), generate a consolidated, categorised shopping list.

Rules:
1. Consolidate duplicate ingredients across all meals into a single line with total quantity.
   Example: if chicken breast appears in 3 meals for a household of 2, combine: "1.2 kg chicken breast"
2. Group items into these categories (use only those that have items): ${SUPERMARKET_CATEGORIES.join(", ")}.
3. Use sensible units: g or kg for meat/veg, litres or ml for liquids, units (e.g. "6 eggs") for countable items, cans/jars for packaged goods.
4. Never put a quantity > 5 kg for a single ingredient — if this happens, recheck your maths.
5. Flag "special" items needed for household dietary needs in a separate "special_items" array. Format: { "item": "Oat milk 2L", "reason": "for [Name] — vegan", "category": "Beverages" }
${specialNotes ? `6. Special dietary needs in this household: ${specialNotes}` : ""}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "categories": {
    "Produce": [{ "item": "Spinach", "qty": "400g" }, ...],
    "Proteins": [...],
    ...
  },
  "special_items": [
    { "item": "Algae DHA supplement", "reason": "for [Name] — vegan", "category": "Other" }
  ]
}`;
}

function extractAllMealNames(plan: Record<string, any>): string {
  const lines: string[] = [];
  for (const [day, meals] of Object.entries(plan)) {
    if (typeof meals !== "object" || !meals) continue;
    for (const [slot, meal] of Object.entries(meals as Record<string, any>)) {
      if (meal?.meal_name) lines.push(`${day} ${slot}: ${meal.meal_name}`);
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { weeklyPlan, familyMembers, householdSize } = await req.json();

    if (!weeklyPlan?.plan) {
      return new Response(
        JSON.stringify({ error: "weeklyPlan.plan is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mealList = extractAllMealNames(weeklyPlan.plan);
    const systemPrompt = buildSystemPrompt(householdSize ?? 1, familyMembers ?? []);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Here is the 7-day meal plan:\n${mealList}\n\nGenerate the grocery list now. Return JSON only.` }],
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

    let parsed: any;
    try {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const str = fence ? fence[1].trim() : raw.trim();
      const objMatch = str.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(objMatch ? objMatch[0] : str);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse grocery list response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure all expected keys are present
    const categories = parsed?.categories ?? {};
    const specialItems = (parsed?.special_items ?? []).filter((s: any) => s?.item);

    return new Response(
      JSON.stringify({ categories, special_items: specialItems }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-grocery-list error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
