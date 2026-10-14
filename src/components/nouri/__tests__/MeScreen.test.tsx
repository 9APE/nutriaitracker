import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeScreen } from "../MeScreen";

vi.mock("@/components/nouri/InsightsScreen", () => ({
  InsightChartList: () => <div>Insight charts</div>,
}));

vi.mock("@/components/nouri/HistoryScreen", () => ({
  MealHistoryList: () => <div>Meal history</div>,
}));

vi.mock("@/lib/nutri-ai-coach", () => ({
  buildNutriAICoach: () => ({
    coachTone: "balanced",
    title: "Protein still matters tonight",
    message: "Stay steady and get one protein-first meal in.",
    window: "Dinner",
    nextBestAction: "Build dinner around a protein anchor.",
    why: ["Dinner tends to slip when protein is low."],
  }),
}));

vi.mock("@/lib/nutri-ai-coach-state", () => ({
  getCoachState: () => ({
    coachTone: "balanced",
    dismissedCheckIns: {},
    seenCheckIns: {},
    notHelpfulCheckIns: {},
    feedbackReasons: {},
    persistentFeedback: {},
    seenPrompts: {},
    dismissedPrompts: {},
    answeredPrompts: {},
  }),
  onCoachStateChange: () => () => {},
}));

const meals = [
  {
    id: "meal-1",
    date: new Date().toISOString().slice(0, 10),
    meal: "Lunch",
    calories: 600,
    protein: 35,
    carbs: 50,
    fat: 20,
  },
] as any;

const goals = {
  calories: 2000,
  protein: 140,
  carbs: 220,
  fat: 70,
} as any;

describe("MeScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to daily signals and can switch to insights", () => {
    render(
      <MeScreen
        meals={meals}
        goals={goals}
        userId="user-1"
        onDelete={vi.fn()}
        onOpenXP={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartCheckin={vi.fn()}
        onOpenFeedback={vi.fn()}
      />,
    );

    expect(screen.getByText("Your nutritionist")).toBeInTheDocument();
    expect(screen.queryByText("Insight charts")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Insights" }));

    expect(screen.getByText("Insight charts")).toBeInTheDocument();
  });

  it("persists the chosen section mode per user", () => {
    const first = render(
      <MeScreen
        meals={meals}
        goals={goals}
        userId="user-42"
        onDelete={vi.fn()}
        onOpenXP={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartCheckin={vi.fn()}
        onOpenFeedback={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Insights" }));
    first.unmount();

    render(
      <MeScreen
        meals={meals}
        goals={goals}
        userId="user-42"
        onDelete={vi.fn()}
        onOpenXP={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartCheckin={vi.fn()}
        onOpenFeedback={vi.fn()}
      />,
    );

    expect(screen.getByText("Insight charts")).toBeInTheDocument();
  });
});
