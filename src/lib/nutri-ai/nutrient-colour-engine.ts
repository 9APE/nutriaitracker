import { METRIC_META, goalForMetric, type Metric } from "@/lib/nouri-dashboard-layout";
import { computeDayTotals } from "@/lib/nouri-nutrient-alerts";
import { isoDateLocal } from "@/lib/nouri-storage";
import {
  deriveNutritionUserContext,
  matchNutritionRules,
} from "@/lib/nutri-ai/nutrition-rule-loader";
import type {
  CoachCheckInWindow,
  ColourState,
  MatchedNutritionRule,
  NutrientEvaluation,
  NutritionEngineInput,
  NutritionEvaluationResult,
  RuleBehavior,
} from "@/lib/nutri-ai/nutrition-rule-types";

const TRACKING_KEY_TO_METRIC: Record<string, Metric | null> = {
  calories: "calories",
  protein: "protein",
  carbohydrates: "carbs",
  carbs: "carbs",
  sugar: "sugar",
  added_sugar: "sugar",
  total_sugar: "sugar",
  fat: "fat",
  fiber: "fiber",
  sodium: "sodium",
  potassium: "potassium",
  cholesterol: "cholesterol",
  saturated_fat: "saturated_fat",
  iron: "iron",
  vitamin_c: "vitamin_c",
  vitamin_d: "vitamin_d",
  vitamin_a: "vitamin_a",
  vitamin_a_retinol: "vitamin_a",
  calcium: "calcium",
  omega_3: null,
  omega3: null,
  gluten: null,
  alcohol: null,
  red_processed_meat: null,
  processed_meat: null,
  lactose: null,
  fodmap: null,
  caffeine: null,
  spicy_foods: null,
  trans_fat: null,
};

const ACTIONS: Record<string, { low: string; high: string; steady: string }> = {
  calories: {
    low: "Make the next meal more substantial so energy catches up without waiting until late.",
    high: "Keep the next meal simpler and let the day settle back into range.",
    steady: "Keep the same steady energy pattern into the next meal.",
  },
  protein: {
    low: "Add a clear protein anchor next, like Greek yogurt, eggs, tofu, fish, or chicken.",
    high: "You do not need to chase more protein right now.",
    steady: "Protein is in a good place. Keep that pattern going.",
  },
  fiber: {
    low: "Add fruit, beans, oats, or vegetables in the next meal or snack.",
    high: "Keep the rest of the day gentle if your gut feels sensitive.",
    steady: "Fiber is tracking well so far.",
  },
  sugar: {
    low: "Keep pairing carbs with protein or fiber so the day stays steadier.",
    high: "Keep the rest of the day lower in added sugar and more centered on protein and fiber.",
    steady: "Sugar is still in a manageable range.",
  },
  sodium: {
    low: "You still have room, but staying with fresher options will help later meals.",
    high: "Make the next meal lower in salt and lighter on packaged foods or sauces.",
    steady: "Sodium is still in a safer range.",
  },
  saturated_fat: {
    low: "Keep leaning on unsaturated fats like olive oil, nuts, seeds, or fish.",
    high: "Shift the next meal away from fried foods, butter, cheese, or processed meat.",
    steady: "Fat quality is holding up well so far.",
  },
  potassium: {
    low: "If this nutrient matters for you, bring in a potassium-rich food next.",
    high: "Stay lighter on very high-potassium foods for the rest of the day.",
    steady: "Potassium is sitting in a reasonable zone right now.",
  },
  gluten: {
    low: "Keep your meals safely gluten-free.",
    high: "Avoid more gluten today and use your usual safe gluten-free options.",
    steady: "Your gluten exposure still looks clear.",
  },
  omega_3: {
    low: "Bring in an omega-3 source like salmon, sardines, chia, flax, or walnuts next.",
    high: "You do not need to chase more here right now.",
    steady: "Omega-3 intake looks supported for now.",
  },
  red_processed_meat: {
    low: "Keep processed meat lower and lean on gentler protein choices.",
    high: "Swap processed meat out of the next meal if you can.",
    steady: "This is not driving the day right now.",
  },
};

function normalize(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function labelForNutrient(nutrientId: string): string {
  const metric = TRACKING_KEY_TO_METRIC[nutrientId];
  if (metric) return METRIC_META[metric].label;
  return nutrientId.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function localDayProgress(now: Date): number {
  const hour = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0.05, (hour - 6) / 16));
}

function parseClock(value?: string): number | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDayProgress(now: Date, wakeTime?: string, sleepTime?: string): number {
  const wakeMinutes = parseClock(wakeTime);
  const sleepMinutes = parseClock(sleepTime);
  if (wakeMinutes == null || sleepMinutes == null || sleepMinutes <= wakeMinutes) {
    return localDayProgress(now);
  }

  const current = now.getHours() * 60 + now.getMinutes();
  const elapsed = current - wakeMinutes;
  const total = sleepMinutes - wakeMinutes;
  return Math.min(1, Math.max(0.05, elapsed / total));
}

function getMealWindow(now: Date, mealsTodayCount: number): CoachCheckInWindow {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 9.5) return "Morning planning";
  if (hour < 11.5) return mealsTodayCount > 0 ? "After breakfast" : "Morning planning";
  if (hour < 14.5) return "Lunch";
  if (hour < 17) return "Afternoon snack rescue";
  if (hour < 20.5) return "Dinner";
  return "Evening review";
}

function getTargetValue(
  nutrientId: string,
  goals: NutritionEngineInput["goals"],
  extendedGoals: NutritionEngineInput["extendedGoals"],
  targetOverrides?: Partial<Record<string, number>>,
): number | undefined {
  if (Object.prototype.hasOwnProperty.call(targetOverrides ?? {}, nutrientId)) {
    return targetOverrides?.[nutrientId];
  }
  const metric = TRACKING_KEY_TO_METRIC[nutrientId];
  if (!metric) return undefined;
  return goalForMetric(metric, (extendedGoals ?? goals) as any);
}

function getCurrentAmount(
  nutrientId: string,
  totals: ReturnType<typeof computeDayTotals>,
  componentTotals?: Partial<Record<string, number>>,
): { amount: number; tracked: boolean } {
  const metric = TRACKING_KEY_TO_METRIC[nutrientId];
  if (metric) {
    return { amount: Number(totals[metric] ?? 0), tracked: true };
  }
  if (componentTotals && Object.prototype.hasOwnProperty.call(componentTotals, nutrientId)) {
    return { amount: Number(componentTotals[nutrientId] ?? 0), tracked: true };
  }
  return { amount: 0, tracked: false };
}

function buildTargets(
  ruleBehavior: RuleBehavior,
  nutrientId: string,
  input: NutritionEngineInput,
): { minTarget?: number; maxTarget?: number } {
  const target = getTargetValue(nutrientId, input.goals, input.extendedGoals, input.targetOverrides);

  switch (ruleBehavior) {
    case "LIMIT_BAD":
    case "AVOID_OR_REDUCE":
    case "STRICT_AVOID":
    case "SYMPTOM_TRIGGER_LIMIT":
      return { maxTarget: target ?? 0 };
    case "RANGE_BALANCED":
    case "CUT_ENERGY":
    case "MAINTAIN_ENERGY":
    case "TARGET_GOOD_WITH_UPPER_CAUTION":
    case "HYDRATION_TARGET":
      return { minTarget: target, maxTarget: target };
    case "TARGET_GOOD":
    case "ENCOURAGE":
    case "CONDITION_OVERRIDE":
    case "BULK_ENERGY":
    case "RECOVERY_TARGET":
      return { minTarget: target };
    case "CLINICIAN_ONLY":
      return target == null ? {} : { minTarget: target, maxTarget: target };
    default:
      return {};
  }
}

function hasExplicitClinicianTarget(nutrientId: string, input: NutritionEngineInput): boolean {
  const managed = Array.isArray(input.userProfile?.clinicianManagedNutrients)
    ? input.userProfile.clinicianManagedNutrients.map((item: unknown) => normalize(String(item)))
    : [];
  if (managed.includes(nutrientId)) return true;
  if (input.targetOverrides && Object.prototype.hasOwnProperty.call(input.targetOverrides, nutrientId)) {
    return true;
  }

  const genericTargets = new Set([
    "calories",
    "protein",
    "carbs",
    "fat",
    "fiber",
    "sugar",
    "sodium",
    "cholesterol",
    "saturated_fat",
  ]);
  if (genericTargets.has(nutrientId)) return false;

  return !!input.extendedGoals && Object.prototype.hasOwnProperty.call(input.extendedGoals, nutrientId);
}

function clampColour(colour: ColourState): ColourState {
  if (colour === "GREEN" || colour === "ORANGE" || colour === "RED" || colour === "NEUTRAL") {
    return colour;
  }
  return "NEUTRAL";
}

function evaluateBehaviour(
  ruleBehavior: RuleBehavior,
  currentAmount: number,
  dayProgress: number,
  targets: { minTarget?: number; maxTarget?: number },
  tracked: boolean,
  triggerActive: boolean,
  clinicianActive: boolean,
): ColourState {
  if (!tracked && ruleBehavior !== "STRICT_AVOID") return "NEUTRAL";
  if (ruleBehavior === "SYMPTOM_TRIGGER_LIMIT" && !triggerActive) return "NEUTRAL";
  if (ruleBehavior === "CLINICIAN_ONLY" && !clinicianActive) return "NEUTRAL";

  const minTarget = targets.minTarget;
  const maxTarget = targets.maxTarget;
  const expectedMinByNow = (minTarget ?? 0) * dayProgress;

  switch (ruleBehavior) {
    case "TARGET_GOOD":
    case "ENCOURAGE":
    case "CONDITION_OVERRIDE":
      if (!minTarget) return "NEUTRAL";
      if (currentAmount >= expectedMinByNow) return "GREEN";
      if (currentAmount >= expectedMinByNow * 0.75) return "ORANGE";
      return "RED";
    case "TARGET_GOOD_WITH_UPPER_CAUTION":
    case "HYDRATION_TARGET":
      if (maxTarget != null && currentAmount > maxTarget) return "RED";
      if (maxTarget != null && currentAmount >= maxTarget * 0.85) return "ORANGE";
      if (!minTarget) return "NEUTRAL";
      if (currentAmount >= expectedMinByNow) return "GREEN";
      if (currentAmount >= expectedMinByNow * 0.75) return "ORANGE";
      return "RED";
    case "LIMIT_BAD":
    case "AVOID_OR_REDUCE":
      if (!maxTarget && maxTarget !== 0) return "NEUTRAL";
      if (currentAmount > maxTarget) return "RED";
      if (currentAmount >= maxTarget * 0.85) return "ORANGE";
      if (currentAmount > maxTarget * dayProgress * 1.25) return "ORANGE";
      return "GREEN";
    case "RANGE_BALANCED":
    case "MAINTAIN_ENERGY":
      if (maxTarget != null && currentAmount > maxTarget) return "RED";
      if (maxTarget != null && currentAmount >= maxTarget * 0.85) return "ORANGE";
      if (!minTarget) return "NEUTRAL";
      if (currentAmount < expectedMinByNow * 0.65) return "RED";
      if (currentAmount < expectedMinByNow * 0.9) return "ORANGE";
      return "GREEN";
    case "STRICT_AVOID":
      return currentAmount > 0 ? "RED" : "GREEN";
    case "SYMPTOM_TRIGGER_LIMIT":
      if (!maxTarget && maxTarget !== 0) return "NEUTRAL";
      if (currentAmount > maxTarget) return "RED";
      if (currentAmount >= maxTarget * 0.85) return "ORANGE";
      return "GREEN";
    case "CLINICIAN_ONLY":
      if (maxTarget != null && currentAmount > maxTarget) return "RED";
      if (maxTarget != null && currentAmount >= maxTarget * 0.85) return "ORANGE";
      if (minTarget != null && currentAmount >= expectedMinByNow) return "GREEN";
      return "ORANGE";
    case "CUT_ENERGY":
      if (maxTarget != null && currentAmount > maxTarget) return "RED";
      if (maxTarget != null && currentAmount >= maxTarget * 0.85) return "ORANGE";
      if (!minTarget) return "NEUTRAL";
      if (currentAmount < expectedMinByNow * 0.7) return "RED";
      if (currentAmount < expectedMinByNow * 0.95) return "ORANGE";
      return "GREEN";
    case "BULK_ENERGY":
      if (!minTarget) return "NEUTRAL";
      if (maxTarget != null && currentAmount > maxTarget) return "ORANGE";
      if (currentAmount >= expectedMinByNow * 0.95) return "GREEN";
      if (currentAmount >= expectedMinByNow * 0.75) return "ORANGE";
      return "RED";
    case "RECOVERY_TARGET":
      if (!minTarget) return "NEUTRAL";
      if (currentAmount >= expectedMinByNow * 0.95) return "GREEN";
      if (currentAmount >= expectedMinByNow * 0.75) return "ORANGE";
      return "RED";
    default:
      return "NEUTRAL";
  }
}

function buildReason(
  label: string,
  colour: ColourState,
  ruleBehavior: RuleBehavior,
  currentAmount: number,
  targets: { minTarget?: number; maxTarget?: number },
  dayProgress: number,
  audience: string,
  tracked: boolean,
): string {
  if (!tracked) {
    return `${label} is not fully tracked in the app yet, so Nutri AI is staying neutral for now.`;
  }

  const expectedMinByNow = Math.round((targets.minTarget ?? 0) * dayProgress * 10) / 10;
  const roundedCurrent = Math.round(currentAmount * 10) / 10;

  if (ruleBehavior === "STRICT_AVOID") {
    return colour === "RED"
      ? `${label} shows exposure today, and ${audience} makes that a strict avoid signal.`
      : `${label} is still clear today, which is what ${audience} needs.`;
  }

  if (colour === "RED") {
    if (targets.maxTarget != null && currentAmount > targets.maxTarget) {
      return `${label} is already over today's safer max for ${audience}.`;
    }
    if (targets.minTarget != null) {
      return `${label} is well behind pace for this point in the day. Nutri AI expected roughly ${expectedMinByNow} by now and sees ${roundedCurrent}.`;
    }
  }

  if (colour === "ORANGE") {
    if (targets.maxTarget != null && currentAmount >= targets.maxTarget * 0.85) {
      return `${label} is getting close to today's max for ${audience}.`;
    }
    if (targets.minTarget != null) {
      return `${label} is a little behind where it usually wants to be by now.`;
    }
  }

  if (colour === "GREEN") {
    if (targets.maxTarget != null && targets.minTarget == null) {
      return `${label} is still inside a safer range for ${audience}.`;
    }
    return `${label} is on track for ${audience}.`;
  }

  return `${label} is neutral for now because Nutri AI does not have enough tracked signal to score it confidently.`;
}

function buildSuggestedAction(nutrientId: string, colour: ColourState): string {
  const action = ACTIONS[nutrientId] ?? {
    low: `Support ${labelForNutrient(nutrientId).toLowerCase()} in the next meal if it matters for you.`,
    high: `Ease off ${labelForNutrient(nutrientId).toLowerCase()} for the rest of today.`,
    steady: `${labelForNutrient(nutrientId)} looks steady right now.`,
  };

  if (colour === "RED" || colour === "ORANGE") {
    return nutrientId === "sugar" || nutrientId === "sodium" || nutrientId === "saturated_fat" || nutrientId === "gluten" || nutrientId === "red_processed_meat"
      ? action.high
      : action.low;
  }
  return action.steady;
}

function scoreEvaluation(
  colour: ColourState,
  overrideRank: number,
  medicalPriority: number,
  currentAmount: number,
  targets: { minTarget?: number; maxTarget?: number },
): number {
  const severity = colour === "RED" ? 300 : colour === "ORANGE" ? 200 : colour === "GREEN" ? 100 : 0;
  const target = targets.maxTarget ?? targets.minTarget ?? 0;
  const gap = target > 0 ? Math.abs(currentAmount - target) / target : 0;
  return severity + medicalPriority + overrideRank + gap * 25;
}

export function evaluateNutrientColours(input: NutritionEngineInput): NutritionEvaluationResult {
  const now = input.now ?? new Date();
  const activeDate = isoDateLocal(now);
  const totals = computeDayTotals(input.meals, activeDate);
  const mealsToday = input.meals.filter((meal) => meal.date === activeDate);
  const userContext = deriveNutritionUserContext(input.userProfile ?? null);
  const matchedRules = matchNutritionRules(userContext);
  const dayProgress = getDayProgress(now, userContext.wakeTime, userContext.sleepTime);
  const mealWindow = getMealWindow(now, mealsToday.length);
  const grouped = new Map<string, MatchedNutritionRule[]>();

  for (const rule of matchedRules) {
    if (!grouped.has(rule.nutrientId)) grouped.set(rule.nutrientId, []);
    grouped.get(rule.nutrientId)!.push(rule);
  }

  const evaluations: NutrientEvaluation[] = [];

  for (const [nutrientId, rules] of grouped.entries()) {
    const bestRule = [...rules].sort((a, b) => {
      const overrideA = Number(a.rule.override_rank ?? 0);
      const overrideB = Number(b.rule.override_rank ?? 0);
      const clinicianA = a.rule.rule_behavior === "CLINICIAN_ONLY" ? (hasExplicitClinicianTarget(nutrientId, input) ? 0 : -1000) : 0;
      const clinicianB = b.rule.rule_behavior === "CLINICIAN_ONLY" ? (hasExplicitClinicianTarget(nutrientId, input) ? 0 : -1000) : 0;
      return (b.medicalPriority + clinicianB) - (a.medicalPriority + clinicianA) || overrideB - overrideA;
    })[0];
    const targets = buildTargets(bestRule.rule.rule_behavior, nutrientId, input);
    const { amount, tracked } = getCurrentAmount(nutrientId, totals, input.componentTotals);
    const triggerActive = userContext.triggerComponents.includes(nutrientId);
    const clinicianActive = hasExplicitClinicianTarget(nutrientId, input);
    const colour = clampColour(
      evaluateBehaviour(
        bestRule.rule.rule_behavior,
        amount,
        dayProgress,
        targets,
        tracked,
        triggerActive,
        clinicianActive,
      ),
    );
    const reason = buildReason(
      labelForNutrient(nutrientId),
      colour,
      bestRule.rule.rule_behavior,
      amount,
      targets,
      dayProgress,
      bestRule.audience,
      tracked,
    );
    const suggestedAction = buildSuggestedAction(nutrientId, colour);
    const overrideRank = Number(bestRule.rule.override_rank ?? 0);
    const medicalPriority = bestRule.medicalPriority;

    evaluations.push({
      nutrientId,
      label: labelForNutrient(nutrientId),
      colour,
      reason,
      suggestedAction,
      currentAmount: amount,
      targetMin: targets.minTarget,
      targetMax: targets.maxTarget,
      dayProgress,
      tracked,
      matchedRules: rules,
      overrideRank,
      medicalPriority,
      ruleBehavior: bestRule.rule.rule_behavior,
      rawRuleTypes: rules.map((item) => item.rule.rule_behavior),
      score: scoreEvaluation(colour, overrideRank, medicalPriority, amount, targets),
    });
  }

  const topRisks = evaluations
    .filter((item) => item.colour === "RED" || item.colour === "ORANGE")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const safetyInstructions = Array.from(
    new Set(
      [
        userContext.safetyFlags.includes("eating-disorder-recovery")
          ? "Avoid weight-loss language and focus on steady nourishment."
          : null,
        userContext.safetyFlags.includes("pregnancy")
          ? "Use cautious wording and avoid supplement or alcohol advice unless the rule explicitly supports it."
          : null,
        userContext.safetyFlags.includes("kidney-caution")
          ? "Do not override clinician guidance for kidney-related limits."
          : null,
        userContext.safetyFlags.includes("diabetes-caution")
          ? "Keep advice practical and centered on steadier choices rather than fear."
          : null,
      ].filter(Boolean) as string[],
    ),
  );

  return {
    userContext,
    mealWindow,
    localTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    dayProgress,
    totals,
    mealsToday,
    matchedRules,
    evaluations: evaluations.sort((a, b) => b.score - a.score),
    topRisks,
    safetyInstructions,
  };
}
