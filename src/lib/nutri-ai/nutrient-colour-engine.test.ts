import { describe, expect, it } from "vitest";
import type { Meal } from "@/lib/nouri-storage";
import { evaluateNutrientColours } from "@/lib/nutri-ai/nutrient-colour-engine";
import { buildNutritionistPriorities } from "@/lib/nutri-ai/nutritionist-priority-engine";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";
import { scheduleNutritionistCheckIn } from "@/lib/nutri-ai/nutritionist-checkin-scheduler";
import { buildNutriAICoach } from "@/lib/nutri-ai-coach";

const DATE = "2026-05-07";

function meal(partial: Partial<Meal>): Meal {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    meal_name: partial.meal_name ?? "Meal",
    type: partial.type ?? "Lunch",
    calories: partial.calories ?? 0,
    protein: partial.protein ?? 0,
    carbs: partial.carbs ?? 0,
    fat: partial.fat ?? 0,
    date: partial.date ?? DATE,
    created_at: partial.created_at ?? Date.now(),
    micros: partial.micros ?? {},
  };
}

function evaluate(args?: {
  goal?: string;
  conditions?: string[];
  meals?: Meal[];
  extendedGoals?: Record<string, number>;
  componentTotals?: Partial<Record<string, number>>;
  targetOverrides?: Partial<Record<string, number>>;
  now?: Date;
}) {
  return evaluateNutrientColours({
    meals: args?.meals ?? [],
    goals: {
      calories: args?.extendedGoals?.calories ?? 2400,
      protein: args?.extendedGoals?.protein ?? 150,
      carbs: args?.extendedGoals?.carbs ?? 240,
      fat: args?.extendedGoals?.fat ?? 75,
    },
    extendedGoals: {
      calories: args?.extendedGoals?.calories ?? 2400,
      protein: args?.extendedGoals?.protein ?? 150,
      carbs: args?.extendedGoals?.carbs ?? 240,
      fat: args?.extendedGoals?.fat ?? 75,
      fiber: args?.extendedGoals?.fiber ?? 30,
      sugar_max: args?.extendedGoals?.sugar_max ?? 50,
      sodium_max: args?.extendedGoals?.sodium_max ?? 2300,
      saturated_fat_max: args?.extendedGoals?.saturated_fat_max ?? 20,
      cholesterol_max: args?.extendedGoals?.cholesterol_max ?? 300,
      potassium: args?.extendedGoals?.potassium ?? 3500,
      calcium: args?.extendedGoals?.calcium ?? 1000,
      iron: args?.extendedGoals?.iron ?? 18,
      vitamin_c: args?.extendedGoals?.vitamin_c ?? 90,
      vitamin_d: args?.extendedGoals?.vitamin_d ?? 20,
      vitamin_a: args?.extendedGoals?.vitamin_a ?? 800,
    },
    userProfile: {
      goals: args?.goal ?? "maintaining",
      conditions: args?.conditions ?? [],
      restrictions: [],
      allergies: [],
      dislikes: [],
    },
    componentTotals: args?.componentTotals,
    targetOverrides: args?.targetOverrides,
    now: args?.now ?? new Date(`${DATE}T16:00:00`),
  });
}

function findColour(result: ReturnType<typeof evaluate>, nutrientId: string) {
  return result.evaluations.find((item) => item.nutrientId === nutrientId)?.colour;
}

function isGreenBodyGoalOnly(item: ReturnType<typeof buildNutritionistPriorities>["priorityNutrients"][number]) {
  return item.colour === "GREEN" && item.matchedRules.every((rule) => rule.matchSource === "goal");
}

describe("evaluateNutrientColours", () => {
  it("scores bulking calories and protein by day progress", () => {
    const behind = evaluate({
      goal: "bulking",
      meals: [meal({ calories: 900, protein: 60 })],
    });
    const onTrack = evaluate({
      goal: "bulking",
      meals: [meal({ calories: 1700, protein: 115 })],
    });

    expect(["ORANGE", "RED"]).toContain(findColour(behind, "calories"));
    expect(findColour(onTrack, "calories")).toBe("GREEN");
    expect(findColour(onTrack, "protein")).toBe("GREEN");
  });

  it("scores cutting calories and protein correctly", () => {
    const underMax = evaluate({
      goal: "cutting",
      meals: [meal({ calories: 1200, protein: 90 })],
      extendedGoals: { calories: 1800, protein: 140 },
    });
    const nearMaxEarly = evaluate({
      goal: "cutting",
      meals: [meal({ calories: 1550, protein: 30 })],
      extendedGoals: { calories: 1800, protein: 140 },
      now: new Date(`${DATE}T13:00:00`),
    });
    const overMax = evaluate({
      goal: "cutting",
      meals: [meal({ calories: 1950, protein: 130 })],
      extendedGoals: { calories: 1800, protein: 140 },
    });

    expect(findColour(underMax, "calories")).toBe("GREEN");
    expect(findColour(nearMaxEarly, "calories")).toBe("ORANGE");
    expect(findColour(overMax, "calories")).toBe("RED");
    expect(["ORANGE", "RED"]).toContain(findColour(nearMaxEarly, "protein"));
  });

  it("lets diabetes override bulking on sugar", () => {
    const onTrack = evaluate({
      goal: "bulking",
      conditions: ["type 2 diabetes"],
      meals: [meal({ calories: 1700, protein: 110, micros: { sugar: 42 } })],
    });
    const overSugar = evaluate({
      goal: "bulking",
      conditions: ["type 2 diabetes"],
      meals: [meal({ calories: 1700, protein: 110, micros: { sugar: 58 } })],
    });

    expect(findColour(onTrack, "calories")).toBe("GREEN");
    expect(findColour(onTrack, "sugar")).toBe("ORANGE");
    expect(findColour(overSugar, "sugar")).toBe("RED");
  });

  it("handles high cholesterol plus bulking conflicts", () => {
    const result = evaluate({
      goal: "bulking",
      conditions: ["high cholesterol"],
      meals: [meal({ calories: 1700, protein: 110, micros: { saturated_fat: 18 }, }), meal({ micros: { fiber: 8 } })],
    });
    const overSatFat = evaluate({
      goal: "bulking",
      conditions: ["high cholesterol"],
      meals: [meal({ calories: 1700, protein: 110, micros: { saturated_fat: 24, fiber: 8 } })],
    });

    expect(findColour(result, "calories")).toBe("GREEN");
    expect(findColour(result, "saturated_fat")).toBe("ORANGE");
    expect(findColour(overSatFat, "saturated_fat")).toBe("RED");
    expect(["ORANGE", "RED"]).toContain(findColour(result, "fiber"));
  });

  it("keeps active condition risks ahead of generic green body-goal items", () => {
    const result = evaluate({
      goal: "bulking",
      conditions: ["high cholesterol"],
      meals: [
        meal({
          calories: 1700,
          protein: 110,
          micros: { saturated_fat: 24, fiber: 28 },
        }),
      ],
    });
    const priority = buildNutritionistPriorities(result);

    expect(priority.priorityNutrients[0].nutrientId).toBe("saturated_fat");
    expect(priority.priorityNutrients[0].colour).toBe("RED");
    expect(priority.priorityNutrients.some(isGreenBodyGoalOnly)).toBe(false);
  });

  it("can still show green condition reassurance when tracked celiac risks are already covered", () => {
    const result = evaluate({
      goal: "healthy eating",
      conditions: ["celiac disease"],
      meals: [meal({ calories: 600, protein: 45, micros: { fiber: 10, iron: 4, vitamin_d: 3, calcium: 150 } })],
      componentTotals: { gluten: 0 },
      targetOverrides: { gluten: 0 },
      now: new Date(`${DATE}T08:00:00`),
    });
    const priority = buildNutritionistPriorities(result);

    expect(findColour(result, "gluten")).toBe("GREEN");
    expect(priority.priorityNutrients.some((item) => item.nutrientId === "gluten" && item.colour === "GREEN")).toBe(true);
  });

  it("scores endometriosis support nutrients without marking all meat red", () => {
    const result = evaluate({
      goal: "healthy eating",
      conditions: ["endometriosis"],
      meals: [meal({ calories: 1400, protein: 95, micros: { fiber: 10 } })],
      componentTotals: {
        omega_3: 0.2,
        red_processed_meat: 1.2,
      },
      targetOverrides: {
        omega_3: 1.2,
        red_processed_meat: 1,
      },
    });

    expect(["ORANGE", "RED"]).toContain(findColour(result, "fiber"));
    expect(["ORANGE", "RED"]).toContain(findColour(result, "omega_3"));
    expect(["ORANGE", "RED"]).toContain(findColour(result, "red_processed_meat"));
    expect(result.evaluations.find((item) => item.nutrientId === "meat")).toBeUndefined();
  });

  it("keeps recovery-safe logic for eating disorder recovery", () => {
    const result = evaluate({
      goal: "cutting",
      conditions: ["eating disorder recovery"],
      meals: [meal({ calories: 700, protein: 40 })],
      extendedGoals: { calories: 2200, protein: 140 },
      now: new Date(`${DATE}T20:30:00`),
    });
    const priority = buildNutritionistPriorities(result);

    expect(findColour(result, "calories")).toBe("RED");
    expect(priority.avoidSaying.join(" ")).toMatch(/lose weight/i);
    expect(priority.message).not.toMatch(/lighter|stricter|deficit/i);
  });

  it("scores celiac gluten as strict avoid when tracked", () => {
    const exposed = evaluate({
      conditions: ["celiac disease"],
      componentTotals: { gluten: 1 },
      targetOverrides: { gluten: 0 },
    });
    const clear = evaluate({
      conditions: ["celiac disease"],
      componentTotals: { gluten: 0 },
      targetOverrides: { gluten: 0 },
    });

    expect(findColour(exposed, "gluten")).toBe("RED");
    expect(findColour(clear, "gluten")).toBe("GREEN");
  });

  it("scores CKD potassium carefully and does not auto-encourage protein", () => {
    const nearMax = evaluate({
      conditions: ["CKD"],
      meals: [meal({ protein: 0, micros: { potassium: 2800 } })],
      extendedGoals: { potassium: 3200, protein: 120 },
    });
    const overMax = evaluate({
      conditions: ["CKD"],
      meals: [meal({ micros: { potassium: 3400 } })],
      extendedGoals: { potassium: 3200, protein: 120 },
    });

    expect(findColour(nearMax, "potassium")).toBe("ORANGE");
    expect(findColour(overMax, "potassium")).toBe("RED");
    const proteinEval = nearMax.evaluations.find((item) => item.nutrientId === "protein");
    expect(!proteinEval || proteinEval.colour !== "GREEN").toBe(true);
  });

  it("suppresses only not-relevant coach feedback for the same window", () => {
    const result = evaluate({
      goal: "bulking",
      meals: [meal({ calories: 900, protein: 50 })],
      now: new Date(`${DATE}T13:00:00`),
    });
    const priority = buildNutritionistPriorities(result);

    const notRelevant = scheduleNutritionistCheckIn(result, priority, {
      dismissedCheckIns: {},
      seenCheckIns: {},
      notHelpfulCheckIns: { Lunch: true },
      feedbackReasons: { Lunch: "not_relevant" },
    }, new Date(`${DATE}T13:00:00`));
    const tooGeneric = scheduleNutritionistCheckIn(result, priority, {
      dismissedCheckIns: {},
      seenCheckIns: {},
      notHelpfulCheckIns: { Lunch: true },
      feedbackReasons: { Lunch: "too_generic" },
    }, new Date(`${DATE}T13:00:00`));

    expect(notRelevant.shouldShow).toBe(false);
    expect(notRelevant.shortReason).toMatch(/not relevant/i);
    expect(tooGeneric.shouldShow).toBe(true);
    expect(tooGeneric.shortReason).toMatch(/too generic/i);
  });

  it("passes feedback reasons into the nutritionist prompt", () => {
    const context = buildNutritionistContext({
      meals: [meal({ calories: 900, protein: 50 })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      userProfile: {
        goals: "bulking",
        conditions: [],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: { Lunch: true },
        feedbackReasons: { Lunch: "too_strict" },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(context.promptBundle.userPrompt).toMatch(/Recent coach feedback/);
    expect(context.promptBundle.userPrompt).toMatch(/Lunch: too strict/);
    expect(context.promptBundle.userPrompt).toMatch(/calmer, less controlling wording/);
  });

  it("adapts visible coach copy after too-strict feedback without changing the rule colour", () => {
    const coach = buildNutriAICoach({
      meals: [meal({ calories: 900, protein: 50 })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      extendedGoals: {
        calories: 2400,
        protein: 150,
        carbs: 240,
        fat: 75,
      },
      userProfile: {
        goals: "bulking",
        conditions: [],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: { Lunch: true },
        feedbackReasons: { Lunch: "too_strict" },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(coach.title).toMatch(/calmly/i);
    expect(coach.message).toMatch(/does not need a perfect day/i);
    expect(coach.nextBestAction).toContain(coach.priorityNutrients[0].suggestedAction);
    expect(coach.why[0]).toMatch(/felt too strict/i);
    expect(coach.mainColour).toBe(coach.priorityNutrients[0].colour);
  });

  it("adapts visible coach copy after too-generic feedback using matched rule context", () => {
    const coach = buildNutriAICoach({
      meals: [meal({ calories: 1700, protein: 110, micros: { saturated_fat: 24, fiber: 8 } })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      extendedGoals: {
        calories: 2400,
        protein: 150,
        carbs: 240,
        fat: 75,
        saturated_fat_max: 20,
        fiber: 30,
      },
      userProfile: {
        goals: "bulking",
        conditions: ["high cholesterol"],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: { Lunch: true },
        feedbackReasons: { Lunch: "too_generic" },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(coach.title).toMatch(coach.priorityNutrients[0].label);
    expect(coach.message).toMatch(coach.priorityNutrients[0].label);
    expect(coach.message).toMatch(/high cholesterol/i);
    expect(coach.nextBestAction).toContain(coach.priorityNutrients[0].suggestedAction);
    expect(coach.why[0]).toMatch(/felt too generic/i);
    expect(coach.mainColour).toBe("RED");
  });

  it("uses persistent nutrient feedback without suppressing medical condition signals", () => {
    const coach = buildNutriAICoach({
      meals: [meal({ calories: 1700, protein: 110, micros: { saturated_fat: 24, fiber: 8 } })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      extendedGoals: {
        calories: 2400,
        protein: 150,
        carbs: 240,
        fat: 75,
        saturated_fat_max: 20,
        fiber: 30,
      },
      userProfile: {
        goals: "bulking",
        conditions: ["high cholesterol"],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: {},
        feedbackReasons: {},
        persistentFeedback: {
          "saturated_fat:any": {
            nutrientId: "saturated_fat",
            audience: "high cholesterol",
            reason: "too_strict",
            count: 2,
            lastAt: Date.now(),
            lastWindow: "Lunch",
          },
        },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(coach.shouldShow).toBe(true);
    expect(coach.mainColour).toBe("RED");
    expect(coach.title).toMatch(/calmly/i);
    expect(coach.why[0]).toMatch(/recent feedback/i);
    expect(coach.why[0]).toMatch(/rule colour stayed the same/i);
  });

  it("passes persistent nutrient feedback into the nutritionist prompt", () => {
    const context = buildNutritionistContext({
      meals: [meal({ calories: 1700, protein: 110, micros: { saturated_fat: 24, fiber: 8 } })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      extendedGoals: {
        calories: 2400,
        protein: 150,
        carbs: 240,
        fat: 75,
        saturated_fat_max: 20,
        fiber: 30,
      },
      userProfile: {
        goals: "bulking",
        conditions: ["high cholesterol"],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: {},
        feedbackReasons: {},
        persistentFeedback: {
          "saturated_fat:any": {
            nutrientId: "saturated_fat",
            audience: "high cholesterol",
            reason: "too_generic",
            count: 3,
            lastAt: Date.now(),
            lastWindow: "Dinner",
          },
        },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(context.promptBundle.userPrompt).toMatch(/Remembered saturated_fat for high cholesterol/);
    expect(context.promptBundle.userPrompt).toMatch(/too generic \(3x\)/);
  });

  it("creates a lunch popup prompt when nothing is logged yet", () => {
    const context = buildNutritionistContext({
      meals: [],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      userProfile: {
        goals: "healthy eating",
        conditions: [],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: {},
        feedbackReasons: {},
        persistentFeedback: {},
        seenPrompts: {},
        dismissedPrompts: {},
        answeredPrompts: {},
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(context.interactivePrompt?.question).toMatch(/lunch/i);
    expect(context.interactivePrompt?.options[0]?.label).toMatch(/log lunch/i);
    expect(context.interactivePrompt?.options[0]?.prefillText).toBe("I had lunch: ");
  });

  it("suppresses a popup prompt after the user already answered it", () => {
    const context = buildNutritionistContext({
      meals: [],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      userProfile: {
        goals: "healthy eating",
        conditions: [],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: {},
        feedbackReasons: {},
        persistentFeedback: {},
        seenPrompts: {},
        dismissedPrompts: {},
        answeredPrompts: {
          "Lunch:general": "primary",
        },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(context.interactivePrompt).toBeNull();
  });

  it("includes answered popup choices in the nutritionist prompt context", () => {
    const context = buildNutritionistContext({
      meals: [meal({ calories: 900, protein: 50 })],
      goals: { calories: 2400, protein: 150, carbs: 240, fat: 75 },
      userProfile: {
        goals: "bulking",
        conditions: [],
        restrictions: [],
        allergies: [],
        dislikes: [],
      },
      coachState: {
        dismissedCheckIns: {},
        seenCheckIns: {},
        notHelpfulCheckIns: {},
        feedbackReasons: {},
        persistentFeedback: {},
        seenPrompts: {},
        dismissedPrompts: {},
        answeredPrompts: {
          "Lunch:protein": "Log a protein add-on",
        },
      },
      now: new Date(`${DATE}T13:00:00`),
    });

    expect(context.promptBundle.userPrompt).toMatch(/Prompt Lunch:protein: Log a protein add-on/);
    expect(context.aiContext.coachFeedback.answeredPrompts[0]).toEqual({
      promptKey: "Lunch:protein",
      answer: "Log a protein add-on",
    });
  });
});
