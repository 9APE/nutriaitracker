import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authState: { user: any } = { user: null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: authState.user, loading: false, signOut: async () => {} }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) } },
}));
vi.mock("@/lib/nouri-cloud", () => ({
  cloud: {
    getProfile: vi.fn().mockResolvedValue({ user_profile_json: null }),
    getGoals: vi.fn().mockResolvedValue(null),
    listMeals: vi.fn().mockResolvedValue([]),
    bulkInsertMeals: vi.fn(),
    upsertGoals: vi.fn(),
  },
}));

import Index from "@/pages/Index";
import { prepareGuestDevice } from "@/lib/guest-mode";

describe("Try for Free (guest) skips onboarding", () => {
  beforeEach(() => localStorage.clear());

  it("lands on the Today screen with no language picker or profile chat", async () => {
    authState.user = { id: "guest-1", is_anonymous: true };
    prepareGuestDevice();
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Log Meal/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/choose your language/i)).toBeNull();
  });

  it("still shows the language picker to a normal new user", async () => {
    authState.user = { id: "user-1", is_anonymous: false };
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/choose your language/i)).toBeTruthy());
    expect(screen.queryAllByText(/Log Meal/i).length).toBe(0);
  });
});
