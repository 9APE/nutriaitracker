// Transcribe audio recorded in the browser using Lovable AI (Gemini multimodal).
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM = `You are a transcription engine. Transcribe the user's spoken meal description verbatim into plain text. Only return the transcript, no commentary, no quotes, no markdown. If the audio is silent or unintelligible, return an empty string.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const audio: string | undefined = body?.audio;
    const mimeType: string = body?.mime_type || "audio/webm";
    const languageName: string =
      typeof body?.languageName === "string" && body.languageName.trim()
        ? body.languageName.trim()
        : "English";
    const locale: string =
      typeof body?.locale === "string" && body.locale.trim() ? body.locale.trim() : "en-US";

    if (!audio || typeof audio !== "string" || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: "audio (base64) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cleanAudio = audio.trim();
    if (cleanAudio.startsWith("data:") && cleanAudio.includes(",")) {
      cleanAudio = cleanAudio.split(",")[1];
    }
    cleanAudio = cleanAudio.replace(/\s/g, "");

    const SYSTEM_PROMPT =
      BASE_SYSTEM +
      `\n\nThe user is speaking in ${languageName} (${locale}). Transcribe in ${languageName} only — preserve the original language exactly as spoken; do not translate.`;

    // Send audio as a data URL in image_url format (Gemini accepts audio this way via OpenAI-compatible API)
    const dataUrl = `data:${mimeType};base64,${cleanAudio}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Transcribe this meal description in ${languageName}.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lovable AI transcription error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcript: string = (data?.choices?.[0]?.message?.content ?? "").trim();

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
