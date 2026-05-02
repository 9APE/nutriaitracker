// Detect preference updates from chat messages
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
        JSON.stringify({ field: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { message, profile } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ field: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p = profile ?? {};

    const systemPrompt = `You are a profile update detector. Given a user's chat message and their current nutrition profile, determine if the message expresses a preference change that should be saved to their profile.

Detectable changes:
- New food dislike → add to profile.dislikes array
- New dietary restriction (vegetarian, vegan, halal, kosher, pescatarian, etc.) → add to profile.restrictions array
- New health condition → add to profile.conditions array
- New allergy → add to profile.allergies array
- New food preference/like → add to profile.preferences array
- Removing a previous restriction or dislike → remove from the relevant array

Current profile:
- Restrictions: ${JSON.stringify(p.restrictions ?? [])}
- Conditions: ${JSON.stringify(p.conditions ?? [])}
- Allergies: ${JSON.stringify(p.allergies ?? [])}
- Dislikes: ${JSON.stringify(p.dislikes ?? [])}
- Preferences: ${JSON.stringify(p.preferences ?? [])}

User message: "${message}"

If a profile update is needed, return ONLY valid JSON: {"field": "dislikes|restrictions|conditions|allergies|preferences", "action": "add|remove", "value": "the item"}
If no update is needed, return ONLY: {"field": null}
Return ONLY the JSON, no markdown fences, no extra text.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 200,
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic error:", response.status, await response.text());
      return new Response(
        JSON.stringify({ field: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const raw: string = data?.content?.[0]?.text ?? "";

    let parsed: { field: string | null; action?: string; value?: string };
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { field: null };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("detect-preference-update error:", e);
    return new Response(
      JSON.stringify({ field: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
