import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, functions: { invoke: (...a: any[]) => invoke(...a) } },
}));

import { PlanScreen } from "@/components/nouri/PlanScreen";
import { GroceryList } from "@/components/nouri/GroceryList";
import { savePlan, getCurrentWeekKey, type WeeklyPlan } from "@/lib/nouri-meal-plan";

const meal = (name: string) => ({ meal_name: name, calories: 400, protein: 30, carbs: 40, fat: 10 });
const day = (p: string) => ({ breakfast: meal(`${p} breakfast`), lunch: meal(`${p} lunch`), dinner: meal(`${p} dinner`), snack: meal(`${p} snack`) });
const goals = { calories: 2000, protein: 150, carbs: 200, fat: 70 } as any;
const plan: WeeklyPlan = { weekKey: getCurrentWeekKey(), createdAt: new Date().toISOString(), mode: "individual", plan: { Monday: day("Mon"), Tuesday: day("Tue") } };

beforeEach(() => { localStorage.clear(); invoke.mockReset(); });

describe("PlanScreen", () => {
  it("lets you click between days", () => {
    savePlan(plan);
    render(<PlanScreen goals={goals} />);
    fireEvent.click(screen.getByRole("tab", { name: "Monday" }));
    expect(screen.getByText("Mon breakfast")).toBeTruthy();
    expect(screen.getByText("Mon snack")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Tuesday" }));
    expect(screen.getByText("Tue breakfast")).toBeTruthy();
    expect(screen.queryByText("Mon breakfast")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Friday" }));
    expect(screen.getByText(/No meals planned for this day/)).toBeTruthy();
  });

  it("asks for days first and does not ask 'who' without family members", () => {
    render(<PlanScreen goals={goals} />);
    expect(screen.getByText("Which days do you want to plan?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Generate full week/ })).toBeTruthy();
    expect(screen.queryByText("Who is this for?")).toBeNull();
  });

  it("asks who it is for when family members exist", () => {
    localStorage.setItem("nutriai:familyProfiles", JSON.stringify([{ id: "a", name: "Lina", restrictions: [], conditions: [], allergies: [], dislikes: [] }]));
    render(<PlanScreen goals={goals} />);
    fireEvent.click(screen.getByRole("button", { name: /Next: who is this for/ }));
    expect(screen.getByText("Who is this for?")).toBeTruthy();
    expect(screen.getByText("Lina")).toBeTruthy();
  });

  it("sends only the selected days to the planner", async () => {
    invoke.mockResolvedValue({ data: { plan: { Monday: day("Mon") } }, error: null });
    render(<PlanScreen goals={goals} />);
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    fireEvent.click(screen.getByRole("button", { name: /Generate Monday/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body.selectedDays).toEqual([0]);
  });
});

describe("GroceryList", () => {
  it("sends weeklyPlan.plan and reads the categories response", async () => {
    invoke.mockResolvedValue({ data: { categories: { Produce: [{ item: "Spinach", qty: "400g" }] }, special_items: [] }, error: null });
    render(<GroceryList plan={plan} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][0]).toBe("generate-grocery-list");
    expect(invoke.mock.calls[0][1].body.weeklyPlan.plan).toEqual(plan.plan);
    await waitFor(() => expect(screen.getByText("Spinach")).toBeTruthy());
  });
});
