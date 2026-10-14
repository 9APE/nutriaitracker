import type { Goals, Meal } from "@/lib/nouri-storage";
import type { ExtendedGoals } from "@/lib/nouri-goals";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";
import type { CoachTone } from "@/lib/nutri-ai-coach-state";
import type {
  NutritionistCheckInState,
  NutritionistFeedbackMemoryEntry,
} from "@/lib/nutri-ai/nutritionist-checkin-scheduler";
import type {
  CoachCheckInWindow,
  CoachFeedbackReason,
  ColourState,
  NutritionistInteractivePromptDecision,
  NutritionistPriorityResult,
} from "@/lib/nutri-ai/nutrition-rule-types";
import { MEAL_WINDOWS } from "@/lib/nouri-suggestions";

export interface NutriAICoachMessage {
  coachTone: CoachTone;
  window: CoachCheckInWindow;
  mealWindow: CoachCheckInWindow;
  title: string;
  message: string;
  cta: string;
  emoji: string;
  accent: "primary" | "good" | "caution" | "bad";
  shouldPop: boolean;
  shouldShow: boolean;
  mainColour: ColourState;
  mainReason: string;
  nextBestAction: string;
  priorityNutrients: Array<{
    nutrientId: string;
    label: string;
    colour: ColourState;
    reason: string;
    suggestedAction: string;
    ruleId?: string;
    audience?: string;
  }>;
  why: string[];
  promptBundle: {
    systemPrompt: string;
    userPrompt: string;
  };
  interactivePrompt: NutritionistInteractivePromptDecision | null;
}

interface CoachArgs {
  meals: Meal[];
  goals: Goals;
  extendedGoals?: ExtendedGoals | null;
  userProfile?: Record<string, any> | null;
  coachState?: NutritionistCheckInState;
  now?: Date;
}

function accentFromColour(colour: ColourState): NutriAICoachMessage["accent"] {
  switch (colour) {
    case "GREEN":
      return "good";
    case "ORANGE":
      return "caution";
    case "RED":
      return "bad";
    default:
      return "primary";
  }
}

function emojiForWindow(window: CoachCheckInWindow) {
  switch (window) {
    case "Morning planning":
      return "\u2600\uFE0F";
    case "After breakfast":
      return "\u{1F963}";
    case "Lunch":
      return "\u{1F37D}\uFE0F";
    case "Afternoon snack rescue":
      return "\u2728";
    case "Dinner":
      return "\u{1F319}";
    case "Evening review":
      return "\u{1FA9E}";
    default:
      return "\u2728";
  }
}

function matchedRuleAudience(priority: NutritionistPriorityResult): string | null {
  return priority.priorityNutrients[0]?.matchedRules[0]?.audience ?? null;
}

function rememberedFeedbackForTopPriority(
  priority: NutritionistPriorityResult,
  coachState: NutritionistCheckInState,
): NutritionistFeedbackMemoryEntry | null {
  const top = priority.priorityNutrients[0];
  if (!top) return null;

  const topRuleIds = new Set(top.matchedRules.map((rule) => rule.rule.rule_id));
  return Object.values(coachState.persistentFeedback ?? {})
    .filter((entry) => entry.nutrientId === top.nutrientId)
    .filter((entry) => !entry.ruleId || topRuleIds.has(entry.ruleId))
    .sort((a, b) => b.lastAt - a.lastAt)[0] ?? null;
}

function adaptVisibleCopy(
  priority: NutritionistPriorityResult,
  window: CoachCheckInWindow,
  coachTone: CoachTone,
  feedbackReason?: CoachFeedbackReason,
  rememberedFeedback?: NutritionistFeedbackMemoryEntry | null,
) {
  const top = priority.priorityNutrients[0];
  const audience = matchedRuleAudience(priority);
  const effectiveFeedbackReason = feedbackReason ?? rememberedFeedback?.reason;
  const feedbackSource = feedbackReason ? "last check-in" : "recent feedback";

  if (effectiveFeedbackReason === "too_strict") {
    return {
      title: top ? `${window} check-in, calmly` : priority.title,
      message: top
        ? `This is still worth noticing, but it does not need a perfect day. ${priority.mainReason} A reasonable next step is: ${priority.nextBestAction}`
        : "Nothing urgent stands out. Keep the next choice simple and useful.",
      nextBestAction: `Keep it practical: ${priority.nextBestAction}`,
      whyPrefix: `Adapted because your ${feedbackSource} said this felt too strict; the rule colour stayed the same.`,
    };
  }

  if (effectiveFeedbackReason === "too_generic" && top) {
    const ruleContext = audience ? ` for ${audience}` : "";
    return {
      title: `${top.label} matters now`,
      message: `${top.label} is ${top.colour}${ruleContext}. ${priority.mainReason} ${priority.nextBestAction}`,
      nextBestAction: `${top.label}: ${priority.nextBestAction}`,
      whyPrefix: audience
        ? `Adapted because your ${feedbackSource} said this felt too generic; this is tied to the matched ${audience} rule.`
        : `Adapted because your ${feedbackSource} said this felt too generic; this is tied to the top rule-engine signal.`,
    };
  }

  const baseCopy = {
    title: priority.title,
    message: priority.message,
    nextBestAction: priority.nextBestAction,
    whyPrefix: null,
  };

  if (coachTone === "supportive") {
    return {
      title: top ? `${window}, gently` : `${window} check-in`,
      message: top
        ? `You're doing fine. ${priority.mainReason} A kind next step would be: ${priority.nextBestAction}`
        : "You're in a steady place right now. Keep the next choice simple.",
      nextBestAction: `Gentle next step: ${priority.nextBestAction}`,
      whyPrefix: "Presentation tuned to your supportive coach tone. The nutrition logic stayed the same.",
    };
  }

  if (coachTone === "direct") {
    return {
      title: top ? `${top.label} needs attention` : priority.title,
      message: top
        ? `${priority.mainReason} Do this next: ${priority.nextBestAction}`
        : "Nothing urgent. Stay consistent at the next meal.",
      nextBestAction: `Do this next: ${priority.nextBestAction}`,
      whyPrefix: "Presentation tuned to your direct coach tone. The nutrition logic stayed the same.",
    };
  }

  if (coachTone === "motivational") {
    return {
      title: top ? `${top.label} is your next win` : `${window} momentum check`,
      message: top
        ? `You're still in this. ${priority.mainReason} Your best move now: ${priority.nextBestAction}`
        : "Momentum looks good. Keep stacking steady wins at the next meal.",
      nextBestAction: `Next win: ${priority.nextBestAction}`,
      whyPrefix: "Presentation tuned to your motivational coach tone. The nutrition logic stayed the same.",
    };
  }

  if (coachTone === "scientific") {
    const audienceNote = audience ? ` Rule context: ${audience}.` : "";
    return {
      title: top ? `${top.label} signal: ${top.colour}` : `${window} review`,
      message: top
        ? `Observation: ${priority.mainReason}${audienceNote} Suggested intervention: ${priority.nextBestAction}`
        : "No priority signals exceeded threshold. Maintain current intake at the next meal.",
      nextBestAction: `Suggested intervention: ${priority.nextBestAction}`,
      whyPrefix:
        "Presentation tuned to your scientific coach tone. Evidence-style framing, same rule-engine output.",
    };
  }

  return baseCopy;
}

export function buildNutriAICoach({
  meals,
  goals,
  extendedGoals,
  userProfile,
  coachState = {
    dismissedCheckIns: {},
    seenCheckIns: {},
    notHelpfulCheckIns: {},
    feedbackReasons: {},
    persistentFeedback: {},
    seenPrompts: {},
    dismissedPrompts: {},
    answeredPrompts: {},
  },
  now = new Date(),
}: CoachArgs): NutriAICoachMessage {
  const { priority, promptBundle, checkIn, interactivePrompt } = buildNutritionistContext({
    meals,
    goals,
    extendedGoals,
    userProfile,
    coachState,
    now,
  });
  const rememberedFeedback = rememberedFeedbackForTopPriority(priority, coachState);
  const visibleCopy = adaptVisibleCopy(
    priority,
    checkIn.window,
    coachState.coachTone ?? "balanced",
    coachState.feedbackReasons?.[checkIn.window],
    rememberedFeedback,
  );

  return {
    coachTone: coachState.coachTone ?? "balanced",
    window: checkIn.window,
    mealWindow: checkIn.window,
    title: visibleCopy.title,
    message: visibleCopy.message,
    cta: checkIn.cta,
    emoji: emojiForWindow(checkIn.window),
    accent: accentFromColour(priority.mainColour),
    shouldPop: checkIn.shouldShow,
    shouldShow: checkIn.shouldShow,
    mainColour: priority.mainColour,
    mainReason: priority.mainReason,
    nextBestAction: visibleCopy.nextBestAction,
    priorityNutrients: priority.priorityNutrients.map((item) => ({
      nutrientId: item.nutrientId,
      label: item.label,
      colour: item.colour,
      reason: item.reason,
      suggestedAction: item.suggestedAction,
      ruleId: item.matchedRules[0]?.rule.rule_id,
      audience: item.matchedRules[0]?.audience,
    })),
    why: [
      visibleCopy.whyPrefix,
      checkIn.shortReason,
      ...priority.priorityNutrients.flatMap((item) =>
        item.matchedRules.slice(0, 2).map((rule) => `${rule.audience}: ${rule.rule.rule_behavior}`),
      ),
    ].filter(Boolean),
    promptBundle,
    interactivePrompt,
  };
}

export function upcomingMealWindows(now = new Date()) {
  return MEAL_WINDOWS.filter((w) => now.getHours() < w.endHour);
}
