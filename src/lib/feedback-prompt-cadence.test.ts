import { describe, expect, it } from "vitest";
import {
  buildSubmittedFeedbackPromptState,
  evaluateFeedbackPromptOpen,
  parseFeedbackPromptState,
} from "../../supabase/functions/_shared/feedback-prompt";

describe("feedback prompt cadence", () => {
  it("prompts every third app open before first submission", () => {
    let state = parseFeedbackPromptState(null);

    const first = evaluateFeedbackPromptOpen({
      previous: state,
      nowIso: "2026-05-29T09:00:00.000Z",
      nowMs: Date.parse("2026-05-29T09:00:00.000Z"),
    });
    expect(first.shouldPrompt).toBe(false);
    state = first.nextState;

    const second = evaluateFeedbackPromptOpen({
      previous: state,
      nowIso: "2026-05-29T10:00:00.000Z",
      nowMs: Date.parse("2026-05-29T10:00:00.000Z"),
    });
    expect(second.shouldPrompt).toBe(false);
    state = second.nextState;

    const third = evaluateFeedbackPromptOpen({
      previous: state,
      nowIso: "2026-05-29T11:00:00.000Z",
      nowMs: Date.parse("2026-05-29T11:00:00.000Z"),
    });
    expect(third.shouldPrompt).toBe(true);
    expect(third.reason).toBe("third_open");
    expect(third.nextState.app_open_count).toBe(3);
    expect(third.nextState.last_prompted_at).toBe("2026-05-29T11:00:00.000Z");
  });

  it("switches to monthly follow-up after feedback submission", () => {
    const submitted = buildSubmittedFeedbackPromptState({
      previous: {
        app_open_count: 6,
        last_prompted_at: "2026-05-01T12:00:00.000Z",
        submitted_at: null,
        next_due_at: null,
      },
      appOpenCountAtSubmit: 6,
      now: new Date("2026-05-05T12:00:00.000Z"),
    });

    const beforeDue = evaluateFeedbackPromptOpen({
      previous: submitted,
      nowIso: "2026-05-20T12:00:00.000Z",
      nowMs: Date.parse("2026-05-20T12:00:00.000Z"),
    });
    expect(beforeDue.shouldPrompt).toBe(false);
    expect(beforeDue.reason).toBe("monthly_follow_up");

    const afterDue = evaluateFeedbackPromptOpen({
      previous: submitted,
      nowIso: "2026-06-06T12:00:00.000Z",
      nowMs: Date.parse("2026-06-06T12:00:00.000Z"),
    });
    expect(afterDue.shouldPrompt).toBe(true);
    expect(afterDue.reason).toBe("monthly_follow_up");
  });
});
