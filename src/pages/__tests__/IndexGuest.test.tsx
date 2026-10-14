import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authState: { user: any; isGuest: boolean } = { user: null, isGuest: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: authState.user, loading: false, isGuest: authState.isGuest, startGuest: () => true, signOut: async () => {} }),
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
import { GUEST_USER } from "@/lib/guest-mode";
import { cloud } from "@/lib/nouri-cloud";

describe("Try for Free (guest) skips onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("lands on the Today screen with no language picker or profile chat", async () => {
    authState.user = GUEST_USER;
    authState.isGuest = true;
    localStorage.setItem("nouri:lang-picked", "1");
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Log Meal/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/choose your language/i)).toBeNull();
    expect(screen.getByText(/Temporary preview/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Exit preview/i })).toBeTruthy();
    // nothing is read from the cloud for a guest
    expect(cloud.getProfile).not.toHaveBeenCalled();
    expect(cloud.listMeals).not.toHaveBeenCalled();
  });

  it("still shows the language picker to a normal new user", async () => {
    authState.user = { id: "user-1", is_anonymous: false };
    authState.isGuest = false;
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/choose your language/i)).toBeTruthy());
    expect(screen.queryAllByText(/Log Meal/i).length).toBe(0);
  });
});
