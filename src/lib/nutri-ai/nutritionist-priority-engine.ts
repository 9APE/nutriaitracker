import type {
  ColourState,
  NutrientEvaluation,
  NutritionEvaluationResult,
  NutritionistPriorityResult,
} from "@/lib/nutri-ai/nutrition-rule-types";

function colourRank(colour: ColourState): number {
  switch (colour) {
    case "RED":
      return 3;
    case "ORANGE":
      return 2;
    case "GREEN":
      return 1;
    default:
      return 0;
  }
}

function buildTitle(result: NutritionEvaluationResult, mainColour: ColourState): string {
  if (result.mealsToday.length === 0 && (result.mealWindow === "Lunch" || result.mealWindow === "Dinner")) {
    return "A gentle nudge";
  }
  if (mainColour === "RED") return `${result.mealWindow} check-in`;
  if (mainColour === "ORANGE") return `${result.mealWindow} check-in`;
  return `${result.mealWindow} is looking steady`;
}

function buildMessage(result: NutritionEvaluationResult, mainColour: ColourState, mainReason: string, nextBestAction: string): string {
  if (result.mealsToday.length === 0 && result.mealWindow === "Lunch") {
    return "You have not logged anything yet today. Nutri AI can help more once the first meal is in, but a simple lunch would still move the day forward.";
  }
  if (result.mealsToday.length === 0 && result.mealWindow === "Dinner") {
    return "There is still time to make the day useful. Start with one solid dinner and let Nutri AI guide the rest from there.";
  }
  if (mainColour === "GREEN") {
    return `${mainReason} The next best move is just to keep the next choice consistent.`;
  }
  return `${mainReason} ${nextBestAction}`;
}

function hasMedicalConditionSignal(item: NutrientEvaluation): boolean {
  return item.matchedRules.some((rule) =>
    rule.matchSource === "condition" ||
    rule.matchSource === "allergy" ||
    rule.matchSource === "intolerance" ||
    rule.matchSource === "safety_flag" ||
    rule.matchSource === "combination" ||
    rule.medicalPriority >= 75,
  );
}

function isBodyGoalOnly(item: NutrientEvaluation): boolean {
  return item.matchedRules.length > 0 && item.matchedRules.every((rule) => rule.matchSource === "goal");
}

function isGreenStrictAvoidReassurance(item: NutrientEvaluation): boolean {
  return item.colour === "GREEN" && item.ruleBehavior === "STRICT_AVOID" && hasMedicalConditionSignal(item);
}

function prioritySort(a: NutrientEvaluation, b: NutrientEvaluation): number {
  const conditionA = hasMedicalConditionSignal(a) ? 1 : 0;
  const conditionB = hasMedicalConditionSignal(b) ? 1 : 0;

  return (
    colourRank(b.colour) - colourRank(a.colour) ||
    conditionB - conditionA ||
    b.medicalPriority - a.medicalPriority ||
    b.score - a.score
  );
}

export function buildNutritionistPriorities(result: NutritionEvaluationResult): NutritionistPriorityResult {
  const recoveryMode =
    result.userContext.safetyFlags.includes("eating-disorder-recovery") ||
    result.userContext.conditions.some((item) => /eating disorder|anorexia|bulimia|recovery/i.test(item));
  const sorted = [...result.evaluations]
    .filter((item) => item.colour !== "NEUTRAL")
    .sort(prioritySort);
  const hasActiveConditionRisk = sorted.some(
    (item) => (item.colour === "RED" || item.colour === "ORANGE") && hasMedicalConditionSignal(item),
  );
  const basePriorityNutrients = sorted
    .filter((item) => !hasActiveConditionRisk || item.colour !== "GREEN" || !isBodyGoalOnly(item))
    .slice(0, 3);
  const reassuringConditionSignal = hasActiveConditionRisk
    ? undefined
    : sorted.find(isGreenStrictAvoidReassurance);
  const priorityNutrients = reassuringConditionSignal &&
    !basePriorityNutrients.some((item) => item.nutrientId === reassuringConditionSignal.nutrientId)
    ? [reassuringConditionSignal, ...basePriorityNutrients].slice(0, 3)
    : basePriorityNutrients;
  const main = priorityNutrients[0];
  const mainColour = main?.colour ?? "NEUTRAL";
  const mainReason = main?.reason ?? "Nothing urgent stands out right now.";
  const nextBestAction =
    main?.suggestedAction ??
    "Keep your next meal simple, balanced, and aligned with your goals.";

  return {
    tone: "supportive",
    title: buildTitle(result, mainColour),
    message: buildMessage(result, mainColour, mainReason, nextBestAction),
    mainColour,
    mainReason,
    priorityNutrients,
    nextBestAction,
    avoidSaying: recoveryMode
      ? ["lose weight", "earn your food", "be stricter tomorrow"]
      : ["you were bad", "cheat day", "you failed"],
    medicalCaution: result.safetyInstructions[0] ?? "Clinician guidance should always override app coaching.",
  };
}
