// Transcribe audio recorded in the browser using Lovable AI (Gemini multimodal).
// Accepts JSON: { audio: <base64 string>, mime_type: <string> }
// Returns: { transcript: <string> }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a transcription engine. Transcribe the user's spoken meal description verbatim into plain text. Only return the transcript, no commentary, no quotes, no markdown. If the audio is silent or unintelligible, return an empty string.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const audio: string | undefined = body?.audio;
    const mimeType: string = body?.mime_type || "audio/webm";

    if (!audio || typeof audio !== "string" || audio.length < 100) {
      return new Response(
        JSON.stringify({ error: "audio (base64) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip any data URL prefix and whitespace — Gemini expects raw base64
    let cleanAudio = audio.trim();
    if (cleanAudio.startsWith("data:") && cleanAudio.includes(",")) {
      cleanAudio = cleanAudio.split(",")[1];
    }
    cleanAudio = cleanAudio.replace(/\s/g, "");
    const format = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "webm";

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
              { type: "text", text: "Transcribe this meal description." },
              { type: "input_audio", input_audio: { data: cleanAudio, format } },
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
        JSON.stringify({ error: "Transcription failed", details: errText }),
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
