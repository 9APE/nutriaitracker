import type { Metric } from "@/lib/nouri-dashboard-layout";
import type { ExtendedGoals } from "@/lib/nouri-goals";
import type { DayTotals } from "@/lib/nouri-nutrient-alerts";
import type { Goals, Meal } from "@/lib/nouri-storage";

export type ColourState = "GREEN" | "ORANGE" | "RED" | "NEUTRAL";

export type RuleType =
  | "TARGET_GOOD"
  | "LIMIT_BAD"
  | "RANGE_BALANCED"
  | "AVOID_OR_REDUCE"
  | "ENCOURAGE"
  | "CONDITION_OVERRIDE"
  | "SYMPTOM_TRIGGER_LIMIT"
  | "CLINICIAN_ONLY"
  | "STRICT_AVOID";

export type RuleBehavior =
  | RuleType
  | "TARGET_GOOD_WITH_UPPER_CAUTION"
  | "CUT_ENERGY"
  | "BULK_ENERGY"
  | "MAINTAIN_ENERGY"
  | "RECOVERY_TARGET"
  | "HYDRATION_TARGET";

export type CoachCheckInWindow =
  | "Morning planning"
  | "After breakfast"
  | "Lunch"
  | "Afternoon snack rescue"
  | "Dinner"
  | "Evening review";

export type CoachFeedbackReason = "too_strict" | "too_generic" | "not_relevant";

export interface NutritionRuleRow {
  rule_id: string;
  condition_or_goal: string;
  condition_category?: string;
  applies_when?: string;
  nutrient_or_component?: string;
  tracking_key?: string;
  nutrient_category?: string;
  rule_behavior: RuleBehavior;
  low_colour?: ColourState;
  medium_colour?: ColourState;
  good_colour?: ColourState;
  near_max_colour?: ColourState;
  over_max_colour?: ColourState;
  time_of_day_model?: string;
  priority?: string;
  conflict_policy?: string;
  evidence_strength?: string;
  evidence_note?: string;
  source_ids?: string;
  implementation_note?: string;
  override_rank?: number;
}

export interface NutritionRuleDatabase {
  version?: string;
  generated_date?: string;
  purpose?: string;
  rules: NutritionRuleRow[];
}

export interface NutritionUserContext {
  goal: string;
  conditions: string[];
  dietaryPattern: string[];
  allergies: string[];
  intolerances: string[];
  safetyFlags: string[];
  wakeTime?: string;
  sleepTime?: string;
  triggerComponents: string[];
}

export interface NutritionEngineInput {
  meals: Meal[];
  goals: Goals;
  extendedGoals?: ExtendedGoals | null;
  userProfile?: Record<string, any> | null;
  now?: Date;
  componentTotals?: Partial<Record<string, number>>;
  targetOverrides?: Partial<Record<string, number>>;
}

export interface MatchedNutritionRule {
  rule: NutritionRuleRow;
  audience: string;
  matchSource: "goal" | "condition" | "dietary_pattern" | "allergy" | "intolerance" | "safety_flag" | "combination";
  nutrientId: string;
  label: string;
  medicalPriority: number;
}

export interface NutrientEvaluation {
  nutrientId: string;
  label: string;
  colour: ColourState;
  reason: string;
  suggestedAction: string;
  currentAmount: number;
  targetMin?: number;
  targetMax?: number;
  dayProgress: number;
  tracked: boolean;
  matchedRules: MatchedNutritionRule[];
  overrideRank: number;
  medicalPriority: number;
  ruleBehavior: RuleBehavior;
  rawRuleTypes: RuleBehavior[];
  score: number;
}

export interface NutritionEvaluationResult {
  userContext: NutritionUserContext;
  mealWindow: CoachCheckInWindow;
  localTime: string;
  dayProgress: number;
  totals: DayTotals;
  mealsToday: Meal[];
  matchedRules: MatchedNutritionRule[];
  evaluations: NutrientEvaluation[];
  topRisks: NutrientEvaluation[];
  safetyInstructions: string[];
}

export interface NutritionistPriorityResult {
  tone: "supportive";
  title: string;
  message: string;
  mainColour: ColourState;
  mainReason: string;
  priorityNutrients: NutrientEvaluation[];
  nextBestAction: string;
  avoidSaying: string[];
  medicalCaution: string;
}

export interface NutritionistPromptBundle {
  systemPrompt: string;
  userPrompt: string;
}

export interface NutritionistCheckInDecision {
  window: CoachCheckInWindow;
  shouldShow: boolean;
  cta: string;
  shortReason: string;
}

export type NutritionistInteractivePromptAction =
  | "log_meal"
  | "view_coach"
  | "dismiss";

export interface NutritionistInteractivePromptOption {
  id: string;
  label: string;
  action: NutritionistInteractivePromptAction;
  prefillText?: string;
}

export interface NutritionistInteractivePromptDecision {
  key: string;
  shouldPrompt: boolean;
  title: string;
  question: string;
  detail: string;
  options: NutritionistInteractivePromptOption[];
  shortReason: string;
}

export type TrackedTotals = DayTotals & Partial<Record<Metric, number>>;
