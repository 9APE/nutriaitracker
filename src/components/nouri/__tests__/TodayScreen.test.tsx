import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }), order: () => ({ limit: async () => ({ data: [] }) }) }) }) })),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { TodayScreen } from "@/components/nouri/TodayScreen";
import { todayISO, isoDateLocal } from "@/lib/nouri-storage";

describe("TodayScreen week strip", () => {
  it("shows the meals of a previous day when it is clicked", () => {
    const now = new Date();
    const today = todayISO();
    // pick the first day of the current week that is before today; skip on Monday
    const dow = (now.getDay() + 6) % 7;
    if (dow === 0) return;
    const prev = new Date(now); prev.setDate(now.getDate() - 1);
    const prevIso = isoDateLocal(prev);
    const mk = (id: string, name: string, date: string) => ({ id, meal_name: name, type: "Lunch" as const, calories: 500, protein: 30, carbs: 50, fat: 10, date, created_at: 1 });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TodayScreen
          goals={{ calories: 2000, protein: 150, carbs: 200, fat: 70 } as any}
          meals={[mk("1", "Today Bowl", today), mk("2", "Yesterday Pasta", prevIso)]}
          userId="u1"
          onDeleteMeal={() => {}}
          onGoLog={() => {}}
          onPickSuggestion={() => {}}
          onOpenXP={() => {}}
          onStartCheckin={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Today's meals")).toBeTruthy();
    const btn = screen.getByRole("button", { name: new RegExp(prev.toLocaleDateString(undefined, { weekday: "long" }), "i") });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    // viewing a past day: heading changes and that day's meal is listed in the meals section
    expect(screen.queryByText("Today's meals")).toBeNull();
    const heading = screen.getByRole("heading", { name: "Meals" });
    expect(heading.closest("section")?.textContent).toContain("Yesterday Pasta");
    expect(heading.closest("section")?.textContent).not.toContain("Today Bowl");
  });
});
