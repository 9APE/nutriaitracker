import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FeedbackPrompt } from "../FeedbackPrompt";

const submitFeedbackMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/feedback-prompt", () => ({
  submitFeedback: (...args: unknown[]) => submitFeedbackMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("FeedbackPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits feedback and closes on success", async () => {
    submitFeedbackMock.mockResolvedValueOnce({
      emailSent: true,
      emailReason: null,
      name: "Ari",
    });
    const onSubmitted = vi.fn();

    render(
      <FeedbackPrompt
        decision={{
          shouldPrompt: true,
          reason: "third_open",
          state: {
            app_open_count: 3,
            last_prompted_at: null,
            submitted_at: null,
            next_due_at: null,
          },
        }}
        onClose={vi.fn()}
        onSubmitted={onSubmitted}
      />,
    );

    fireEvent.click(screen.getByLabelText("Rate 5 stars"));
    fireEvent.change(screen.getByLabelText("Name (optional)"), {
      target: { value: "Ari" },
    });
    fireEvent.change(screen.getByLabelText("What should we improve?"), {
      target: { value: "The hydration reminders are great." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(submitFeedbackMock).toHaveBeenCalledWith({
        rating: 5,
        message: "The hydration reminders are great.",
        name: "Ari",
        appOpenCountAtSubmit: 3,
      });
    });
    expect(onSubmitted).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows the monthly follow-up heading when prompted later", () => {
    render(
      <FeedbackPrompt
        decision={{
          shouldPrompt: true,
          reason: "monthly_follow_up",
          state: {
            app_open_count: 12,
            last_prompted_at: "2026-05-01T00:00:00.000Z",
            submitted_at: "2026-04-01T00:00:00.000Z",
            next_due_at: "2026-06-01T00:00:00.000Z",
          },
        }}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    expect(screen.getByText("How is Nutri AI feeling now?")).toBeInTheDocument();
  });
});
