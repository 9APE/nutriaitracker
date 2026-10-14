import type { Goals, Meal } from "@/lib/nouri-storage";
import type { ExtendedGoals } from "@/lib/nouri-goals";
import { evaluateNutrientColours } from "@/lib/nutri-ai/nutrient-colour-engine";
import { buildNutritionistPriorities } from "@/lib/nutri-ai/nutritionist-priority-engine";
import { buildNutritionistPrompt } from "@/lib/nutri-ai/nutritionist-prompt-builder";
import {
  scheduleNutritionistCheckIn,
  type NutritionistCheckInState,
} from "@/lib/nutri-ai/nutritionist-checkin-scheduler";
import { buildNutritionistInteractivePrompt } from "@/lib/nutri-ai/nutritionist-interactive-prompts";
import type {
  CoachCheckInWindow,
  CoachFeedbackReason,
  ColourState,
  NutritionEvaluationResult,
  NutritionistCheckInDecision,
  NutritionistInteractivePromptDecision,
  NutritionistPriorityResult,
  NutritionistPromptBundle,
} from "@/lib/nutri-ai/nutrition-rule-types";

export interface SerializableNutritionistContext {
  goal: string;
  conditions: string[];
  dietaryPattern: string[];
  allergies: string[];
  familyMembers: Array<{
    name: string;
    age?: string | number;
    conditions: string[];
    allergies: string[];
    restrictions: string[];
    goals: string[];
    dislikes: string[];
  }>;
  safetyFlags: string[];
  localTime: string;
  mealWindow: CoachCheckInWindow;
  dayProgressPercent: number;
  mealsLoggedToday: Array<{
    meal_name: string;
    type: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  nutrientEvaluations: Array<{
    nutrientId: string;
    label: string;
    colour: ColourState;
    reason: string;
    suggestedAction: string;
    currentAmount: number;
    targetMin?: number;
    targetMax?: number;
  }>;
  matchedRules: Array<{
    ruleId: string;
    audience: string;
    nutrientId: string;
    label: string;
    behavior: string;
    overrideRank: number;
  }>;
  topRisks: Array<{
    nutrientId: string;
    label: string;
    colour: ColourState;
    reason: string;
    suggestedAction: string;
  }>;
  coachFeedback: {
    dismissedCheckIns: string[];
    notHelpfulCheckIns: string[];
    feedbackReasons: Array<{
      window: CoachCheckInWindow;
      reason: CoachFeedbackReason;
    }>;
    answeredPrompts: Array<{
      promptKey: string;
      answer: string;
    }>;
    lastTopPriority?: string;
  };
  safetyInstructions: string[];
}

export interface NutritionistContextBundle {
  evaluation: NutritionEvaluationResult;
  priority: NutritionistPriorityResult;
  promptBundle: NutritionistPromptBundle;
  checkIn: NutritionistCheckInDecision;
  interactivePrompt: NutritionistInteractivePromptDecision | null;
  aiContext: SerializableNutritionistContext;
}

export interface BuildNutritionistContextArgs {
  meals: Meal[];
  goals: Goals;
  extendedGoals?: ExtendedGoals | null;
  userProfile?: Record<string, any> | null;
  coachState?: NutritionistCheckInState;
  now?: Date;
}

function emptyCoachState(): NutritionistCheckInState {
  return {
    dismissedCheckIns: {},
    seenCheckIns: {},
    notHelpfulCheckIns: {},
    feedbackReasons: {},
    persistentFeedback: {},
    seenPrompts: {},
    dismissedPrompts: {},
    answeredPrompts: {},
  };
}

function serialiseContext(
  evaluation: NutritionEvaluationResult,
  priority: NutritionistPriorityResult,
  coachState: NutritionistCheckInState,
  userProfile?: Record<string, any> | null,
): SerializableNutritionistContext {
  const priorityIds = new Set(priority.priorityNutrients.map((item) => item.nutrientId));
  const familyMembers = Array.isArray(userProfile?.familyMembers) ? userProfile.familyMembers : [];

  return {
    goal: evaluation.userContext.goal,
    conditions: evaluation.userContext.conditions,
    dietaryPattern: evaluation.userContext.dietaryPattern,
    allergies: [...evaluation.userContext.allergies, ...evaluation.userContext.intolerances],
    familyMembers: familyMembers.slice(0, 8).map((member: any) => ({
      name: String(member?.name ?? "Family member"),
      age: member?.age,
      conditions: Array.isArray(member?.conditions) ? member.conditions : [],
      allergies: Array.isArray(member?.allergies) ? member.allergies : [],
      restrictions: Array.isArray(member?.restrictions) ? member.restrictions : [],
      goals: Array.isArray(member?.goals) ? member.goals : [],
      dislikes: Array.isArray(member?.dislikes) ? member.dislikes : [],
    })),
    safetyFlags: evaluation.userContext.safetyFlags,
    localTime: evaluation.localTime,
    mealWindow: evaluation.mealWindow,
    dayProgressPercent: Math.round(evaluation.dayProgress * 100),
    mealsLoggedToday: evaluation.mealsToday.map((meal) => ({
      meal_name: meal.meal_name,
      type: meal.type,
      calories: Math.round(meal.calories || 0),
      protein: Math.round(meal.protein || 0),
      carbs: Math.round(meal.carbs || 0),
      fat: Math.round(meal.fat || 0),
    })),
    nutrientEvaluations: priority.priorityNutrients.map((item) => ({
      nutrientId: item.nutrientId,
      label: item.label,
      colour: item.colour,
      reason: item.reason,
      suggestedAction: item.suggestedAction,
      currentAmount: item.currentAmount,
      targetMin: item.targetMin,
      targetMax: item.targetMax,
    })),
    matchedRules: evaluation.matchedRules
      .filter((rule) => priorityIds.has(rule.nutrientId))
      .slice(0, 12)
      .map((rule) => ({
        ruleId: rule.rule.rule_id,
        audience: rule.audience,
        nutrientId: rule.nutrientId,
        label: rule.label,
        behavior: rule.rule.rule_behavior,
        overrideRank: Number(rule.rule.override_rank ?? 0),
      })),
    topRisks: evaluation.topRisks.slice(0, 5).map((item) => ({
      nutrientId: item.nutrientId,
      label: item.label,
      colour: item.colour,
      reason: item.reason,
      suggestedAction: item.suggestedAction,
    })),
    coachFeedback: {
      dismissedCheckIns: Object.keys(coachState.dismissedCheckIns ?? {}),
      notHelpfulCheckIns: Object.keys(coachState.notHelpfulCheckIns ?? {}),
      feedbackReasons: Object.entries(coachState.feedbackReasons ?? {}).map(([window, reason]) => ({
        window: window as CoachCheckInWindow,
        reason,
      })),
      answeredPrompts: Object.entries(coachState.answeredPrompts ?? {})
        .slice(-5)
        .map(([promptKey, answer]) => ({
          promptKey,
          answer,
        })),
      lastTopPriority: coachState.lastTopPriority,
    },
    safetyInstructions: evaluation.safetyInstructions,
  };
}

export function buildNutritionistContext({
  meals,
  goals,
  extendedGoals,
  userProfile,
  coachState = emptyCoachState(),
  now = new Date(),
}: BuildNutritionistContextArgs): NutritionistContextBundle {
  const evaluation = evaluateNutrientColours({
    meals,
    goals,
    extendedGoals,
    userProfile,
    now,
  });
  const priority = buildNutritionistPriorities(evaluation);
  const promptBundle = buildNutritionistPrompt(evaluation, priority, coachState);
  const checkIn = scheduleNutritionistCheckIn(evaluation, priority, coachState, now);
  const interactivePrompt = buildNutritionistInteractivePrompt(evaluation, priority, checkIn, coachState, now);

  return {
    evaluation,
    priority,
    promptBundle,
    checkIn,
    interactivePrompt,
    aiContext: serialiseContext(evaluation, priority, coachState, userProfile),
  };
}
