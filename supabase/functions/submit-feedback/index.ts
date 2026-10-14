import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireAuth } from "../_shared/auth.ts";
import {
  buildSubmittedFeedbackPromptState,
  parseFeedbackPromptState,
} from "../_shared/feedback-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendFeedbackEmail(args: {
  name: string;
  rating: number;
  message: string;
  to: string;
}) {
  const discordWebhook = Deno.env.get("DISCORD_WEBHOOK") ?? "";
  const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("FEEDBACK_FROM_EMAIL") ?? "";

  const subject = `NutriAI feedback From user ${args.name}`;
  const text = [
    `Name: ${args.name}`,
    `Rating: ${args.rating}/5`,
    "",
    "Message:",
    args.message,
  ].join("\n");

  if (discordWebhook) {
    const response = await fetch(discordWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: [
          "New Nutri AI feedback",
          `From: ${args.name}`,
          `Rating: ${args.rating}/5`,
          "",
          args.message,
        ].join("\n"),
      }),
    });

    if (response.ok) {
      return { sent: true, reason: null, provider: "discord" } as const;
    }

    const responseText = await response.text();
    console.warn("[submit-feedback] discord failed:", responseText);
    if (!from || (!brevoApiKey && !resendApiKey)) {
      return { sent: false, reason: "delivery_not_configured" } as const;
    }
  }

  if (!from || (!brevoApiKey && !resendApiKey)) {
    return { sent: false, reason: "delivery_not_configured" } as const;
  }

  if (brevoApiKey) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: from,
          name: "Nutri AI Feedback",
        },
        to: [{ email: args.to }],
        subject,
        textContent: text,
      }),
    });

    if (response.ok) {
      return { sent: true, reason: null, provider: "brevo" } as const;
    }

    const responseText = await response.text();
    console.warn("[submit-feedback] brevo failed:", responseText);
    if (!resendApiKey) {
      return { sent: false, reason: "email_send_failed" } as const;
    }
  }

  if (!resendApiKey) {
    return { sent: false, reason: "email_not_configured" } as const;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.warn("[submit-feedback] resend failed:", responseText);
    return { sent: false, reason: "email_send_failed" } as const;
  }

  return { sent: true, reason: null, provider: "resend" } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const userId = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON", code: "invalid_json" });
  }

  const rating = Number(body?.rating);
  const message = String(body?.message ?? "").trim();
  const enteredName = String(body?.name ?? "").trim();
  const skipDelivery = body?.skip_delivery === true;
  const deliveredDirectly = body?.delivered_directly === true;
  const deliveryProvider =
    typeof body?.delivery_provider === "string" && body.delivery_provider.trim()
      ? body.delivery_provider.trim()
      : null;
  const appOpenCountAtSubmit =
    typeof body?.app_open_count_at_submit === "number" && Number.isFinite(body.app_open_count_at_submit)
      ? Math.max(0, Math.floor(body.app_open_count_at_submit))
      : null;

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return json(400, { error: "Rating must be between 1 and 5", code: "invalid_rating" });
  }
  if (!message) {
    return json(400, { error: "Feedback message is required", code: "message_required" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_KEY") ??
    "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: "Service not configured", code: "service_not_configured" });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profileRow } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const resolvedName =
    enteredName ||
    String(profileRow?.display_name ?? "").trim() ||
    "Anonymous";

  const { data: currentStateRow } = await sb
    .from("user_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  const stateBag =
    currentStateRow?.state && typeof currentStateRow.state === "object" && !Array.isArray(currentStateRow.state)
      ? { ...(currentStateRow.state as Record<string, unknown>) }
      : {};
  const previousFeedbackPromptState = parseFeedbackPromptState(stateBag.feedback_prompt);

  const emailResult = skipDelivery
    ? {
        sent: deliveredDirectly,
        reason: deliveredDirectly ? null : "delivery_skipped",
        provider: deliveryProvider ?? "skipped",
      }
    : await sendFeedbackEmail({
        name: resolvedName,
        rating: Math.round(rating),
        message,
        to: Deno.env.get("FEEDBACK_TO_EMAIL") ?? "Ariimoanapons@gmail.com",
      });

  const { error: insertError } = await sb.from("feedback_submissions").insert({
    user_id: userId,
    name: resolvedName,
    rating: Math.round(rating),
    message,
    app_open_count_at_submit: appOpenCountAtSubmit,
    email_sent: emailResult.sent,
  });

  if (insertError) {
    return json(500, { error: insertError.message, code: "feedback_insert_failed" });
  }

  const feedbackPromptState = buildSubmittedFeedbackPromptState({
    previous: previousFeedbackPromptState,
    appOpenCountAtSubmit,
    now: new Date(),
  });
  stateBag.feedback_prompt = feedbackPromptState;

  const { error: stateError } = await sb.from("user_state").upsert({
    user_id: userId,
    state: stateBag,
  });

  if (stateError) {
    return json(500, { error: stateError.message, code: "state_save_failed" });
  }

  return json(200, {
    ok: true,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
    emailProvider: "provider" in emailResult ? emailResult.provider : null,
    name: resolvedName,
  });
});
