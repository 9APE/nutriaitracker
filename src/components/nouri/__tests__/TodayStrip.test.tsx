import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, functions: { invoke: vi.fn() } },
}));

import { TodayScreen } from "@/components/nouri/TodayScreen";
import { todayISO } from "@/lib/nouri-storage";

describe("TodayScreen week strip", () => {
  it("switches to a previous day when it is clicked", () => {
    const now = new Date();
    if ((now.getDay() + 6) % 7 === 0) return; // Monday has no earlier day in the same week
    const prev = new Date(now);
    prev.setDate(now.getDate() - 1);
    const prevIso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
    const mk = (id: string, name: string, date: string) => ({ id, meal_name: name, type: "Lunch" as const, calories: 500, protein: 30, carbs: 50, fat: 10, date, created_at: 1 });
    render(
      <TodayScreen
        goals={{ calories: 2000, protein: 150, carbs: 200, fat: 70 } as any}
        meals={[mk("1", "Today Bowl", todayISO()), mk("2", "Yesterday Pasta", prevIso)]}
        onDeleteMeal={() => {}}
        onGoLog={() => {}}
        onPickSuggestion={() => {}}
        onOpenXP={() => {}}
        onStartCheckin={() => {}}
      />,
    );
    expect(screen.getByText("Today's meals")).toBeTruthy();
    const btn = screen.getByRole("button", { name: new RegExp(prev.toLocaleDateString(undefined, { weekday: "long" }), "i") });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Today's meals")).toBeNull();
    const section = screen.getByRole("heading", { name: "Meals" }).closest("section");
    expect(section?.textContent).toContain("Yesterday Pasta");
    expect(section?.textContent).not.toContain("Today Bowl");
  });
});
