export type FeedbackPromptState = {
  app_open_count: number;
  last_prompted_at: string | null;
  submitted_at: string | null;
  next_due_at: string | null;
};

export type FeedbackPromptReason = "third_open" | "monthly_follow_up";

const DEFAULT_STATE: FeedbackPromptState = {
  app_open_count: 0,
  last_prompted_at: null,
  submitted_at: null,
  next_due_at: null,
};

export function parseFeedbackPromptState(input: unknown): FeedbackPromptState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_STATE };
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

export function evaluateFeedbackPromptOpen(args: {
  previous: FeedbackPromptState;
  nowIso?: string;
  nowMs?: number;
}): {
  shouldPrompt: boolean;
  reason: FeedbackPromptReason;
  nextState: FeedbackPromptState;
} {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const nowMs = args.nowMs ?? Date.now();
  const previous = args.previous;
  const nextAppOpenCount = previous.app_open_count + 1;
  const nextDueTime =
    previous.next_due_at && !Number.isNaN(Date.parse(previous.next_due_at))
      ? Date.parse(previous.next_due_at)
      : null;
  const hasSubmitted = !!previous.submitted_at;

  const shouldPrompt = hasSubmitted
    ? nextDueTime != null && nextDueTime <= nowMs
    : nextAppOpenCount % 3 === 0;

  return {
    shouldPrompt,
    reason: hasSubmitted ? "monthly_follow_up" : "third_open",
    nextState: {
      ...previous,
      app_open_count: nextAppOpenCount,
      last_prompted_at: shouldPrompt ? nowIso : previous.last_prompted_at,
    },
  };
}

export function buildSubmittedFeedbackPromptState(args: {
  previous: FeedbackPromptState;
  appOpenCountAtSubmit?: number | null;
  now?: Date;
}): FeedbackPromptState {
  const now = args.now ?? new Date();
  const nextDue = new Date(now);
  nextDue.setMonth(nextDue.getMonth() + 1);

  return {
    app_open_count:
      typeof args.previous.app_open_count === "number"
        ? args.previous.app_open_count
        : args.appOpenCountAtSubmit ?? 0,
    last_prompted_at: args.previous.last_prompted_at ?? now.toISOString(),
    submitted_at: now.toISOString(),
    next_due_at: nextDue.toISOString(),
  };
}
