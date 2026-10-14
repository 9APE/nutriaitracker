import rulesJson from "@/data/nutri-ai/condition-colour-rules.json";
import type {
  MatchedNutritionRule,
  NutritionRuleDatabase,
  NutritionRuleRow,
  NutritionUserContext,
} from "@/lib/nutri-ai/nutrition-rule-types";

const CONDITION_ALIASES: Record<string, string> = {
  "type 1 diabetes": "type 1 diabetes",
  "type 2 diabetes": "type 2 diabetes",
  diabetes: "type 2 diabetes",
  "prediabetes / insulin resistance": "prediabetes / insulin resistance",
  prediabetes: "prediabetes / insulin resistance",
  "insulin resistance": "prediabetes / insulin resistance",
  hypertension: "hypertension",
  "high blood pressure": "hypertension",
  "high cholesterol": "high cholesterol",
  cholesterol: "high cholesterol",
  "heart disease": "heart disease",
  "kidney disease": "chronic kidney disease - non dialysis",
  ckd: "chronic kidney disease - non dialysis",
  "chronic kidney disease": "chronic kidney disease - non dialysis",
  pcos: "pcos",
  ibs: "ibs",
  "celiac disease": "celiac disease",
  celiac: "celiac disease",
  "lactose intolerance": "lactose intolerance",
  endometriosis: "endometriosis",
  pregnancy: "pregnancy",
  vegan: "vegan",
  vegetarian: "vegetarian",
  "gluten-free": "gluten-free",
  "gluten free": "gluten-free",
  "low-fodmap": "low-fodmap / elimination phase",
  "low fodmap": "low-fodmap / elimination phase",
  "lactose-free": "lactose intolerance",
  "lactose free": "lactose intolerance",
  "eating disorder recovery": "anorexia nervosa recovery / restrictive eating disorder recovery",
  "anorexia recovery": "anorexia nervosa recovery / restrictive eating disorder recovery",
  "restrictive eating disorder recovery": "anorexia nervosa recovery / restrictive eating disorder recovery",
  "bulimia recovery": "bulimia nervosa recovery",
  "binge eating disorder": "binge eating disorder",
};

const GOAL_LABELS = {
  cut: ["cutting / fat loss"],
  bulk: ["lean bulk", "bulking / muscle gain", "strength athlete"],
  maintain: ["maintenance", "maintenance / healthy eating", "eat healthy"],
  endurance: ["endurance athlete", "sports performance / endurance"],
  recovery: ["recovery / under-fuelling", "malnutrition risk"],
} as const;

const NUTRIENT_ALIASES: Record<string, string> = {
  added_sugar: "sugar",
  total_sugar: "sugar",
  carbohydrates: "carbs",
  omega3: "omega_3",
  processed_meat: "red_processed_meat",
};

function normalize(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function inferGoalLabels(goal: string, safetyFlags: string[]): string[] {
  const g = normalize(goal);
  const labels = new Set<string>();

  if (/(bulk|gain|muscle|surplus)/.test(g)) GOAL_LABELS.bulk.forEach((label) => labels.add(label));
  if (/(cut|lose|fat loss|weight loss)/.test(g)) GOAL_LABELS.cut.forEach((label) => labels.add(label));
  if (/(maintain|healthy|wellness|balanced)/.test(g) || labels.size === 0) {
    GOAL_LABELS.maintain.forEach((label) => labels.add(label));
  }
  if (/(endurance|performance|athlete|sport|race)/.test(g)) GOAL_LABELS.endurance.forEach((label) => labels.add(label));
  if (/(recover|recovery|underfuel|under-fuel)/.test(g)) GOAL_LABELS.recovery.forEach((label) => labels.add(label));
  if (safetyFlags.some((flag) => flag.includes("eating-disorder-recovery"))) {
    labels.add("anorexia recovery + maintenance");
  }

  return [...labels];
}

function goalMatches(label: string, goalLabels: string[]): boolean {
  return goalLabels.some((goalLabel) => label === goalLabel);
}

function textIncludesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function inferMedicalPriority(row: NutritionRuleRow, audience: string): number {
  const category = normalize(row.condition_category);
  const behavior = normalize(row.rule_behavior);
  if (behavior === "strict_avoid" || audience.includes("allergy")) return 100;
  if (audience.includes("recovery") || audience.includes("eating disorder")) return 95;
  if (behavior === "clinician_only") return 90;
  if (audience.includes("pregnan")) return 75;
  if (category.includes("medical") || category.includes("condition")) return 80;
  if (category.includes("goal")) return 60;
  if (category.includes("dietary")) return 40;
  return 20;
}

function labelForTrackingKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function canonicalNutrientId(value: string): string {
  const normalized = normalize(value);
  return NUTRIENT_ALIASES[normalized] ?? normalized;
}

export function loadNutritionRuleDatabase(): NutritionRuleDatabase {
  const parsed = rulesJson as NutritionRuleDatabase;
  return {
    ...parsed,
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
  };
}

export function deriveNutritionUserContext(userProfile?: Record<string, any> | null): NutritionUserContext {
  const conditions = Array.isArray(userProfile?.conditions) ? userProfile.conditions.map(String) : [];
  const restrictions = Array.isArray(userProfile?.restrictions) ? userProfile.restrictions.map(String) : [];
  const preferences = Array.isArray(userProfile?.preferences) ? userProfile.preferences.map(String) : [];
  const allergies = Array.isArray(userProfile?.allergies) ? userProfile.allergies.map(String) : [];
  const dislikes = Array.isArray(userProfile?.dislikes) ? userProfile.dislikes.map(String) : [];
  const goal = String(userProfile?.goals ?? "healthy eating");
  const safetyFlags = new Set<string>();

  if (textIncludesAny(normalize(goal), ["recovery", "under-fuel"]) || conditions.some((item) => normalize(item).includes("recovery"))) {
    safetyFlags.add("eating-disorder-recovery");
  }
  if (conditions.some((item) => normalize(item).includes("pregnan"))) {
    safetyFlags.add("pregnancy");
  }
  if (conditions.some((item) => normalize(item).includes("kidney"))) {
    safetyFlags.add("kidney-caution");
  }
  if (conditions.some((item) => normalize(item).includes("diabet"))) {
    safetyFlags.add("diabetes-caution");
  }

  return {
    goal,
    conditions,
    dietaryPattern: [...restrictions, ...preferences].filter(Boolean),
    allergies,
    intolerances: dislikes.filter((item) => /intoler|lactose|fodmap/i.test(item)),
    safetyFlags: [...safetyFlags],
    wakeTime: typeof userProfile?.wakeTime === "string" ? userProfile.wakeTime : undefined,
    sleepTime: typeof userProfile?.sleepTime === "string" ? userProfile.sleepTime : undefined,
    triggerComponents: Array.isArray(userProfile?.triggerComponents)
      ? userProfile.triggerComponents.map((item: unknown) => normalize(String(item)))
      : [],
  };
}

export function matchNutritionRules(context: NutritionUserContext): MatchedNutritionRule[] {
  const database = loadNutritionRuleDatabase();
  const normalizedConditions = new Set(context.conditions.map((item) => CONDITION_ALIASES[normalize(item)] ?? normalize(item)));
  const normalizedPatterns = new Set(context.dietaryPattern.map((item) => CONDITION_ALIASES[normalize(item)] ?? normalize(item)));
  const normalizedAllergies = new Set(context.allergies.map((item) => normalize(item)));
  const normalizedIntolerances = new Set(context.intolerances.map((item) => CONDITION_ALIASES[normalize(item)] ?? normalize(item)));
  const goalLabels = inferGoalLabels(context.goal, context.safetyFlags);
  const matched: MatchedNutritionRule[] = [];

  for (const rule of database.rules) {
    const audience = normalize(rule.condition_or_goal);
    const nutrientId = canonicalNutrientId(rule.tracking_key || rule.nutrient_or_component || "");
    let matchSource: MatchedNutritionRule["matchSource"] | null = null;

    if (goalMatches(audience, goalLabels)) {
      matchSource = "goal";
    } else if (
      audience === "high cholesterol + bulking" &&
      normalizedConditions.has("high cholesterol") &&
      GOAL_LABELS.bulk.some((label) => goalLabels.includes(label))
    ) {
      matchSource = "combination";
    } else if (
      audience === "endometriosis + eat healthy" &&
      normalizedConditions.has("endometriosis") &&
      GOAL_LABELS.maintain.some((label) => goalLabels.includes(label))
    ) {
      matchSource = "combination";
    } else if (normalizedConditions.has(audience)) {
      matchSource = "condition";
    } else if (normalizedPatterns.has(audience)) {
      matchSource = "dietary_pattern";
    } else if (normalizedIntolerances.has(audience)) {
      matchSource = "intolerance";
    } else if (normalizedAllergies.has(audience)) {
      matchSource = "allergy";
    } else if (
      context.safetyFlags.some((flag) => audience.includes(flag.replace(/-/g, " "))) ||
      (audience.includes("recovery") && context.safetyFlags.includes("eating-disorder-recovery"))
    ) {
      matchSource = "safety_flag";
    }

    if (!matchSource) continue;

    matched.push({
      rule,
      audience: rule.condition_or_goal,
      matchSource,
      nutrientId,
      label: labelForTrackingKey(nutrientId),
      medicalPriority: inferMedicalPriority(rule, audience),
    });
  }

  return matched.sort((a, b) => {
    const rankA = Number(a.rule.override_rank ?? 0);
    const rankB = Number(b.rule.override_rank ?? 0);
    return b.medicalPriority - a.medicalPriority || rankB - rankA;
  });
}
