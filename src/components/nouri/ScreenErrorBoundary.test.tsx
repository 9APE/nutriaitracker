import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ScreenErrorBoundary } from "@/components/nouri/ScreenErrorBoundary";

function CrashOnRender() {
  throw new Error("Boom");
}

function CrashOnEffect() {
  useEffect(() => {
    throw new Error("Effect boom");
  }, []);

  return <div>Loaded</div>;
}

describe("ScreenErrorBoundary", () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("shows a visible fallback instead of blanking the screen", () => {
    render(
      <ScreenErrorBoundary title="This Nutri AI screen hit an error">
        <CrashOnRender />
      </ScreenErrorBoundary>,
    );

    expect(screen.getByText("This Nutri AI screen hit an error")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("resets when the tab changes", () => {
    const { rerender } = render(
      <ScreenErrorBoundary resetKey="today">
        <CrashOnEffect />
      </ScreenErrorBoundary>,
    );

    expect(screen.getByText("This page hit an error")).toBeInTheDocument();

    rerender(
      <ScreenErrorBoundary resetKey="log">
        <div>Recovered screen</div>
      </ScreenErrorBoundary>,
    );

    expect(screen.getByText("Recovered screen")).toBeInTheDocument();
  });
});
