import type {
  NutritionEvaluationResult,
  NutritionistCheckInDecision,
  NutritionistInteractivePromptDecision,
  NutritionistInteractivePromptOption,
  NutritionistPriorityResult,
} from "@/lib/nutri-ai/nutrition-rule-types";
import type { NutritionistCheckInState } from "@/lib/nutri-ai/nutritionist-checkin-scheduler";

const PROMPT_COOLDOWN_MS = 1000 * 60 * 75;

function nextMealLabel(window: NutritionEvaluationResult["mealWindow"]) {
  switch (window) {
    case "Morning planning":
      return "breakfast";
    case "After breakfast":
      return "lunch";
    case "Lunch":
      return "the afternoon";
    case "Afternoon snack rescue":
      return "dinner";
    case "Dinner":
      return "tonight";
    case "Evening review":
      return "tomorrow morning";
    default:
      return "later today";
  }
}

function promptOptions(
  primaryLabel: string,
  primaryPrefillText: string,
  secondaryLabel = "Not now",
): NutritionistInteractivePromptOption[] {
  return [
    { id: "primary", label: primaryLabel, action: "log_meal", prefillText: primaryPrefillText },
    { id: "secondary", label: secondaryLabel, action: "dismiss" },
  ];
}

export function buildNutritionistInteractivePrompt(
  result: NutritionEvaluationResult,
  priority: NutritionistPriorityResult,
  checkIn: NutritionistCheckInDecision,
  state: NutritionistCheckInState,
  now = new Date(),
): NutritionistInteractivePromptDecision | null {
  if (!checkIn.shouldShow) return null;

  const top = priority.priorityNutrients[0];
  const noMealsLogged = result.mealsToday.length === 0;
  const nextMeal = nextMealLabel(result.mealWindow);

  if (result.mealWindow === "Lunch" && noMealsLogged) {
    const key = `${result.mealWindow}:general`;
    if (state.dismissedPrompts?.[key] || state.answeredPrompts?.[key]) {
      return null;
    }
    if (state.lastPromptTime && now.getTime() - state.lastPromptTime < PROMPT_COOLDOWN_MS) {
      return null;
    }
    return {
      key,
      shouldPrompt: true,
      title: "Nutri AI check-in",
      question: "Have you had lunch yet?",
      detail: "Nothing is logged yet, so Nutri AI is flying half-blind for the rest of the afternoon.",
      options: promptOptions("Log lunch", "I had lunch: ", "Not yet"),
      shortReason: "Lunch is the first useful point to ask for a real-world update if nothing is logged.",
    };
  }

  if (!top) return null;

  const key = `${result.mealWindow}:${top.nutrientId}`;
  if (state.dismissedPrompts?.[key] || state.answeredPrompts?.[key]) {
    return null;
  }

  if (state.lastPromptTime && now.getTime() - state.lastPromptTime < PROMPT_COOLDOWN_MS) {
    return null;
  }

  if (["protein", "fiber", "calories"].includes(top.nutrientId) && top.colour !== "GREEN") {
    const actionLabel =
      top.nutrientId === "protein"
        ? "Log a protein add-on"
        : top.nutrientId === "fiber"
          ? "Log a fiber add-on"
          : "Log a catch-up meal";
    const primaryPrefillText =
      top.nutrientId === "protein"
        ? "I had a protein snack: "
        : top.nutrientId === "fiber"
          ? "I had a fiber-rich food: "
          : "I had a catch-up meal: ";

    return {
      key,
      shouldPrompt: true,
      title: `${top.label} check-in`,
      question: `Do you want help catching up on ${top.label.toLowerCase()} before ${nextMeal}?`,
      detail: `${top.reason} ${top.suggestedAction}`,
      options: promptOptions(actionLabel, primaryPrefillText, "I already have a plan"),
      shortReason: "Catch-up nutrients are the best place for an interactive nudge because a small action can still help today.",
    };
  }

  if (["sugar", "sodium", "saturated_fat", "cholesterol"].includes(top.nutrientId) && top.colour !== "GREEN") {
    return {
      key,
      shouldPrompt: true,
      title: `${top.label} check-in`,
      question: `Want a gentler next-meal reset for ${top.label.toLowerCase()}?`,
      detail: `${top.reason} ${top.suggestedAction}`,
      options: promptOptions("Log the next meal", "For my next meal I had: ", "I can manage this"),
      shortReason: "Limit-style nutrients are best handled with a quick course correction before the next meal.",
    };
  }

  if (result.mealWindow === "Evening review") {
    return {
      key,
      shouldPrompt: true,
      title: "Nutri AI evening check-in",
      question: "Do you want a quick final log before the day wraps up?",
      detail: top.reason,
      options: promptOptions("Log something now", "Tonight I had: ", "Maybe tomorrow"),
      shortReason: "Evening review is a good moment for one last check without over-messaging.",
    };
  }

  return null;
}
