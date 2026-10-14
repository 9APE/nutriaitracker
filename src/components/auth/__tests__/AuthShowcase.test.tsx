import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AuthShowcase, SLIDES } from "@/components/auth/AuthShowcase";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthShowcase", () => {
  it("starts on the first feature and lets you jump between features", () => {
    render(<AuthShowcase onTryFree={() => {}} />);
    expect(screen.getByText(SLIDES[0].title)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: SLIDES[3].label }));
    expect(screen.getByText(SLIDES[3].title)).toBeTruthy();
  });

  it("auto-advances to the next feature", () => {
    vi.useFakeTimers();
    render(<AuthShowcase onTryFree={() => {}} />);
    act(() => {
      vi.advanceTimersByTime(SLIDES[0].ms + 50);
    });
    expect(screen.getByText(SLIDES[1].title)).toBeTruthy();
  });

  it("calls onTryFree from the Try for Free button", () => {
    const onTryFree = vi.fn();
    render(<AuthShowcase onTryFree={onTryFree} />);
    fireEvent.click(screen.getByRole("button", { name: /Try for Free/ }));
    expect(onTryFree).toHaveBeenCalled();
  });
});
