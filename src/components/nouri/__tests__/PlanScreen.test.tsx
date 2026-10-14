import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import { PlanScreen } from "@/components/nouri/PlanScreen";
import { savePlan, getCurrentWeekKey } from "@/lib/nouri-meal-plan";

const meal = (name: string) => ({ meal_name: name, calories: 400, protein: 30, carbs: 40, fat: 10 });
const day = (prefix: string) => ({
  breakfast: meal(`${prefix} breakfast`),
  lunch: meal(`${prefix} lunch`),
  dinner: meal(`${prefix} dinner`),
  snack: meal(`${prefix} snack`),
});

describe("PlanScreen day tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    savePlan({
      weekKey: getCurrentWeekKey(),
      createdAt: new Date().toISOString(),
      mode: "individual",
      plan: { Monday: day("Mon"), Tuesday: day("Tue") },
    });
  });

  it("switches the visible meals when a day tab is clicked, including snacks", () => {
    render(<PlanScreen goals={{ calories: 2000, protein: 150, carbs: 200, fat: 70 } as any} />);

    fireEvent.click(screen.getByRole("tab", { name: "Monday" }));
    expect(screen.getByText("Mon breakfast")).toBeTruthy();
    expect(screen.getByText("Mon snack")).toBeTruthy();
    expect(screen.queryByText("Tue breakfast")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Tuesday" }));
    expect(screen.getByText("Tue breakfast")).toBeTruthy();
    expect(screen.queryByText("Mon breakfast")).toBeNull();
  });

  it("shows an empty state for a day with no plan", () => {
    render(<PlanScreen goals={{ calories: 2000, protein: 150, carbs: 200, fat: 70 } as any} />);
    fireEvent.click(screen.getByRole("tab", { name: "Friday" }));
    expect(screen.getByText(/No meals planned for this day/)).toBeTruthy();
  });

  it("asks for days first and skips the 'who' step when there is no family", () => {
    localStorage.clear();
    render(<PlanScreen goals={{ calories: 2000, protein: 150, carbs: 200, fat: 70 } as any} />);
    expect(screen.getByText("Which days do you want to plan?")).toBeTruthy();
    expect(screen.queryByText("Who is this for?")).toBeNull();
    // with no family the primary button generates directly
    expect(screen.getByRole("button", { name: /Generate full week/ })).toBeTruthy();
  });
});
