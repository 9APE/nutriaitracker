import type {
  CoachFeedbackReason,
  CoachCheckInWindow,
  NutritionEvaluationResult,
  NutritionistCheckInDecision,
  NutritionistPriorityResult,
} from "@/lib/nutri-ai/nutrition-rule-types";
import type { CoachTone } from "@/lib/nutri-ai-coach-state";

export interface NutritionistCheckInState {
  lastCheckInTime?: number;
  lastPromptTime?: number;
  dismissedCheckIns: Partial<Record<CoachCheckInWindow, true>>;
  seenCheckIns: Partial<Record<CoachCheckInWindow, true>>;
  notHelpfulCheckIns: Partial<Record<CoachCheckInWindow, true>>;
  feedbackReasons?: Partial<Record<CoachCheckInWindow, CoachFeedbackReason>>;
  persistentFeedback?: Record<string, NutritionistFeedbackMemoryEntry>;
  seenPrompts?: Record<string, true>;
  dismissedPrompts?: Record<string, true>;
  answeredPrompts?: Record<string, string>;
  lastTopPriority?: string;
  snackRescueShown?: boolean;
  eveningReviewShown?: boolean;
  coachTone?: CoachTone;
}

export interface NutritionistFeedbackMemoryEntry {
  nutrientId: string;
  ruleId?: string;
  audience?: string;
  reason: Exclude<CoachFeedbackReason, "not_relevant">;
  count: number;
  lastAt: number;
  lastWindow: CoachCheckInWindow;
}

function defaultCta(window: CoachCheckInWindow) {
  switch (window) {
    case "Morning planning":
      return "Plan the next meal";
    case "After breakfast":
      return "See what matters next";
    case "Lunch":
      return "See lunch focus";
    case "Afternoon snack rescue":
      return "Get snack help";
    case "Dinner":
      return "See dinner focus";
    case "Evening review":
      return "Review today";
    default:
      return "See ideas";
  }
}

export function scheduleNutritionistCheckIn(
  result: NutritionEvaluationResult,
  priority: NutritionistPriorityResult,
  state: NutritionistCheckInState,
  now = new Date(),
): NutritionistCheckInDecision {
  const window = result.mealWindow;
  const topPriority = priority.priorityNutrients[0];
  const noMealsLogged = result.mealsToday.length === 0;
  const feedbackReason = state.feedbackReasons?.[window];
  const legacyNotHelpful = state.notHelpfulCheckIns[window] && !feedbackReason;

  if (state.dismissedCheckIns[window] || feedbackReason === "not_relevant" || legacyNotHelpful) {
    return {
      window,
      shouldShow: false,
      cta: defaultCta(window),
      shortReason: feedbackReason === "not_relevant" || legacyNotHelpful
        ? "The user said this check-in was not relevant today."
        : "The user already dismissed this check-in today.",
    };
  }

  if (
    state.seenCheckIns[window] &&
    state.lastTopPriority === topPriority?.nutrientId &&
    state.lastCheckInTime &&
    now.getTime() - state.lastCheckInTime < 1000 * 60 * 90
  ) {
    return {
      window,
      shouldShow: false,
      cta: defaultCta(window),
      shortReason: "The same priority was already shown recently.",
    };
  }

  if (window === "Afternoon snack rescue") {
    const snackNeeded =
      topPriority &&
      ["protein", "fiber", "calories"].includes(topPriority.nutrientId) &&
      (topPriority.colour === "RED" || topPriority.colour === "ORANGE");
    if (!snackNeeded || state.snackRescueShown) {
      return {
        window,
        shouldShow: false,
        cta: defaultCta(window),
        shortReason: "Snack rescue is only shown when a practical catch-up move is useful.",
      };
    }
  }

  if (window === "Evening review" && state.eveningReviewShown) {
    return {
      window,
      shouldShow: false,
      cta: defaultCta(window),
      shortReason: "Evening review already showed today.",
    };
  }

  if (window === "Lunch" && noMealsLogged) {
    return {
      window,
      shouldShow: true,
      cta: "Log lunch",
      shortReason: "Nothing is logged yet, so a gentle lunch reminder is useful.",
    };
  }

  if (!topPriority) {
    return {
      window,
      shouldShow: window === "Morning planning" || window === "Evening review",
      cta: defaultCta(window),
      shortReason: "When there is no strong nutrient signal, only lighter planning moments should show.",
    };
  }

  if (feedbackReason === "too_strict") {
    return {
      window,
      shouldShow: true,
      cta: defaultCta(window),
      shortReason: `The user said recent coaching felt too strict, so keep this practical and calm. ${topPriority.reason}`,
    };
  }

  if (feedbackReason === "too_generic") {
    return {
      window,
      shouldShow: true,
      cta: defaultCta(window),
      shortReason: `The user said recent coaching felt too generic, so connect this to today's logged meals and matched rules. ${topPriority.reason}`,
    };
  }

  return {
    window,
    shouldShow: true,
    cta: defaultCta(window),
    shortReason: topPriority.reason,
  };
}
