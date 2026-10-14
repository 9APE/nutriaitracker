import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const from = vi.fn(() => {
  throw new Error("guests must not touch the database");
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: any[]) => (from as any)(...a),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    channel: vi.fn(() => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) })),
    removeChannel: vi.fn(),
  },
}));

const authState: { user: any; isGuest: boolean } = { user: null, isGuest: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: authState.user, loading: false, isGuest: authState.isGuest, startGuest: () => true, signOut: async () => {} }),
}));

import Index from "@/pages/Index";
import { GUEST_USER } from "@/lib/guest-mode";

const renderIndex = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Try for Free (guest preview)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    authState.user = GUEST_USER;
    authState.isGuest = true;
  });

  it("goes straight to Today with a preview banner and never touches the database", async () => {
    renderIndex();
    await waitFor(() => expect(screen.getByText(/Temporary preview/i)).toBeTruthy());
    expect(screen.queryByText(/choose your language/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Exit preview/i })).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it("lets a guest add a meal by hand on the Log tab", async () => {
    renderIndex();
    await waitFor(() => expect(screen.getByText(/Temporary preview/i)).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Nutri AI")!);
    await waitFor(() => expect(screen.getByLabelText("Meal name")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Meal name"), { target: { value: "Oat bowl" } });
    fireEvent.change(screen.getByLabelText("Calories"), { target: { value: "450" } });
    fireEvent.click(screen.getByRole("button", { name: "Add meal" }));
    await waitFor(() => expect(screen.getAllByText("Oat bowl").length).toBeGreaterThan(0));
    expect(from).not.toHaveBeenCalled();
  });
});
