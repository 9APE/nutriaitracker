import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIRECT_DISCORD_WEBHOOK_STORAGE_KEY, submitFeedback } from "./feedback-prompt";

const invokeMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_DISCORD_WEBHOOK", "");
    window.localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends directly to Discord when a webhook is present in local storage", async () => {
    window.localStorage.setItem(
      DIRECT_DISCORD_WEBHOOK_STORAGE_KEY,
      "https://discord.example/webhook",
    );
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
    invokeMock.mockResolvedValueOnce({
      data: {
        emailSent: false,
        emailReason: null,
        name: "Ari",
      },
      error: null,
    });

    const result = await submitFeedback({
      rating: 5,
      message: "This is much nicer.",
      name: "Ari",
      appOpenCountAtSubmit: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://discord.example/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: ["New Nutri AI feedback", "From: Ari", "Rating: 5/5", "", "This is much nicer."].join("\n"),
      }),
    });
    expect(invokeMock).toHaveBeenCalledWith("submit-feedback", {
      body: {
        rating: 5,
        message: "This is much nicer.",
        name: "Ari",
        app_open_count_at_submit: 3,
        skip_delivery: true,
        delivered_directly: true,
        delivery_provider: "client_discord",
      },
    });
    expect(result).toEqual({
      emailSent: true,
      emailReason: null,
      name: "Ari",
      persisted: true,
    });
  });

  it("falls back to the Supabase function when no direct webhook is configured", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        emailSent: false,
        emailReason: "delivery_not_configured",
        name: "Anonymous",
      },
      error: null,
    });

    const result = await submitFeedback({
      rating: 4,
      message: "Fallback path",
      name: "",
      appOpenCountAtSubmit: 6,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("submit-feedback", {
      body: {
        rating: 4,
        message: "Fallback path",
        name: "",
        app_open_count_at_submit: 6,
      },
    });
    expect(result).toEqual({
      emailSent: false,
      emailReason: "delivery_not_configured",
      name: "Anonymous",
      persisted: true,
    });
  });

  it("throws if Discord delivery works but persistence fails", async () => {
    window.localStorage.setItem(
      DIRECT_DISCORD_WEBHOOK_STORAGE_KEY,
      "https://discord.example/webhook",
    );
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "state_save_failed" },
    });

    await expect(
      submitFeedback({
        rating: 5,
        message: "Still needs saving.",
        name: "Ari",
        appOpenCountAtSubmit: 3,
      }),
    ).rejects.toThrow("Feedback reached Discord, but we couldn't save it in the app yet.");
  });
});
