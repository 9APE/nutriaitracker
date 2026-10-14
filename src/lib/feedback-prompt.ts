import { supabase } from "@/integrations/supabase/client";

export const DIRECT_DISCORD_WEBHOOK_STORAGE_KEY = "nouri:discord-webhook";
const LOCAL_FEEDBACK_PROMPT_STATE_KEY = "nouri:feedback-prompt-state";

export interface FeedbackPromptState {
  app_open_count: number;
  last_prompted_at: string | null;
  submitted_at: string | null;
  next_due_at: string | null;
}

export interface FeedbackPromptDecision {
  shouldPrompt: boolean;
  reason: "third_open" | "monthly_follow_up";
  state: FeedbackPromptState;
}

interface SubmitFeedbackResult {
  emailSent: boolean;
  emailReason: string | null;
  name: string;
  persisted: boolean;
}

function parseFeedbackPromptState(input: unknown): FeedbackPromptState {
  if (!input || typeof input !== "object") {
    return {
      app_open_count: 0,
      last_prompted_at: null,
      submitted_at: null,
      next_due_at: null,
    };
  }

  const state = input as Record<string, unknown>;
  return {
    app_open_count:
      typeof state.app_open_count === "number" && Number.isFinite(state.app_open_count)
        ? Math.max(0, Math.floor(state.app_open_count))
        : 0,
    last_prompted_at:
      typeof state.last_prompted_at === "string" ? state.last_prompted_at : null,
    submitted_at: typeof state.submitted_at === "string" ? state.submitted_at : null,
    next_due_at: typeof state.next_due_at === "string" ? state.next_due_at : null,
  };
}

function evaluateFeedbackPromptOpen(previous: FeedbackPromptState): FeedbackPromptDecision {
  const now = new Date();
  const nextAppOpenCount = previous.app_open_count + 1;
  const nextDueTime =
    previous.next_due_at && !Number.isNaN(Date.parse(previous.next_due_at))
      ? Date.parse(previous.next_due_at)
      : null;
  const hasSubmitted = !!previous.submitted_at;
  const shouldPrompt = hasSubmitted
    ? nextDueTime != null && nextDueTime <= now.getTime()
    : nextAppOpenCount % 3 === 0;

  return {
    shouldPrompt,
    reason: hasSubmitted ? "monthly_follow_up" : "third_open",
    state: {
      ...previous,
      app_open_count: nextAppOpenCount,
      last_prompted_at: shouldPrompt ? now.toISOString() : previous.last_prompted_at,
    },
  };
}

function buildSubmittedFeedbackPromptState(
  previous: FeedbackPromptState,
  appOpenCountAtSubmit?: number | null,
): FeedbackPromptState {
  const now = new Date();
  const nextDue = new Date(now);
  nextDue.setMonth(nextDue.getMonth() + 1);

  return {
    app_open_count:
      typeof previous.app_open_count === "number"
        ? previous.app_open_count
        : appOpenCountAtSubmit ?? 0,
    last_prompted_at: previous.last_prompted_at ?? now.toISOString(),
    submitted_at: now.toISOString(),
    next_due_at: nextDue.toISOString(),
  };
}

function readLocalFeedbackPromptState(): FeedbackPromptState {
  if (typeof window === "undefined") {
    return parseFeedbackPromptState(null);
  }
  try {
    return parseFeedbackPromptState(
      JSON.parse(window.localStorage.getItem(LOCAL_FEEDBACK_PROMPT_STATE_KEY) ?? "null"),
    );
  } catch {
    return parseFeedbackPromptState(null);
  }
}

function writeLocalFeedbackPromptState(state: FeedbackPromptState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_FEEDBACK_PROMPT_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function buildLocalFeedbackPromptDecision() {
  const decision = evaluateFeedbackPromptOpen(readLocalFeedbackPromptState());
  writeLocalFeedbackPromptState(decision.state);
  return decision;
}

function markLocalFeedbackSubmitted(appOpenCountAtSubmit?: number | null) {
  writeLocalFeedbackPromptState(
    buildSubmittedFeedbackPromptState(readLocalFeedbackPromptState(), appOpenCountAtSubmit),
  );
}

function shouldUseLocalFeedbackPromptState() {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function getDirectDiscordWebhook() {
  const envWebhook = String(import.meta.env.VITE_DISCORD_WEBHOOK ?? "").trim();
  if (envWebhook) return envWebhook;
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(DIRECT_DISCORD_WEBHOOK_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

async function submitFeedbackDirectlyToDiscord(args: {
  rating: number;
  message: string;
  name?: string;
  appOpenCountAtSubmit?: number;
}): Promise<SubmitFeedbackResult | null> {
  const webhook = getDirectDiscordWebhook();
  if (!webhook) return null;

  const resolvedName = args.name?.trim() || "Anonymous";
  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: [
        "New Nutri AI feedback",
        `From: ${resolvedName}`,
        `Rating: ${Math.round(args.rating)}/5`,
        "",
        args.message.trim(),
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord delivery failed (${response.status})`);
  }

  const { error } = await supabase.functions.invoke("submit-feedback", {
    body: {
      rating: args.rating,
      message: args.message,
      name: args.name?.trim() || "",
      app_open_count_at_submit: args.appOpenCountAtSubmit ?? null,
      skip_delivery: true,
      delivered_directly: true,
      delivery_provider: "client_discord",
    },
  });
  if (error) {
    throw new Error("Feedback reached Discord, but we couldn't save it in the app yet.");
  }

  markLocalFeedbackSubmitted(args.appOpenCountAtSubmit ?? null);

  return {
    emailSent: true,
    emailReason: null,
    name: resolvedName,
    persisted: true,
  };
}

export async function fetchFeedbackPromptDecision(): Promise<FeedbackPromptDecision> {
  if (shouldUseLocalFeedbackPromptState()) {
    return buildLocalFeedbackPromptDecision();
  }

  const { data, error } = await supabase.functions.invoke("feedback-prompt-state", {
    body: {},
  });
  if (error) {
    return buildLocalFeedbackPromptDecision();
  }

  const decision = {
    shouldPrompt: !!data?.shouldPrompt,
    reason: (data?.reason === "monthly_follow_up" ? "monthly_follow_up" : "third_open") as FeedbackPromptDecision["reason"],
    state: {
      app_open_count: Number(data?.state?.app_open_count ?? 0),
      last_prompted_at:
        typeof data?.state?.last_prompted_at === "string" ? data.state.last_prompted_at : null,
      submitted_at:
        typeof data?.state?.submitted_at === "string" ? data.state.submitted_at : null,
      next_due_at:
        typeof data?.state?.next_due_at === "string" ? data.state.next_due_at : null,
    },
  };
  writeLocalFeedbackPromptState(decision.state);
  return decision;
}

export async function submitFeedback(args: {
  rating: number;
  message: string;
  name?: string;
  appOpenCountAtSubmit?: number;
}): Promise<SubmitFeedbackResult> {
  const directResult = await submitFeedbackDirectlyToDiscord(args);
  if (directResult) return directResult;

  const { data, error } = await supabase.functions.invoke("submit-feedback", {
    body: {
      rating: args.rating,
      message: args.message,
      name: args.name?.trim() || "",
      app_open_count_at_submit: args.appOpenCountAtSubmit ?? null,
    },
  });
  if (error) throw new Error(error.message);
  markLocalFeedbackSubmitted(args.appOpenCountAtSubmit ?? null);
  return {
    emailSent: !!data?.emailSent,
    emailReason: typeof data?.emailReason === "string" ? data.emailReason : null,
    name: typeof data?.name === "string" ? data.name : "",
    persisted: true,
  };
}
