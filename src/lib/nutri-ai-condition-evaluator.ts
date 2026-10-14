import rulesData from "@/data/nutri-ai-condition-rules.v2.json";
import { METRIC_META, goalForMetric, type Metric } from "@/lib/nouri-dashboard-layout";

export type RuleStatus = "good" | "caution" | "bad" | "neutral";

export interface EvaluatedConditionMetric {
  condition: string;
  metric: Metric;
  label: string;
  unit: string;
  consumed: number;
  target: number;
  pct: number;
  status: RuleStatus;
  behavior: string;
  overrideRank: number;
  explanation: string;
  implementationNote?: string;
}

export interface MetricStatusSummary {
  metric: Metric;
  status: RuleStatus;
  conditions: string[];
  explanations: string[];
}

interface RuleRow {
  condition_or_goal?: string;
  tracking_key?: string;
  nutrient_or_component?: string;
  rule_behavior?: string;
  override_rank?: number;
  implementation_note?: string;
}

interface EvaluateArgs {
  conditions: string[];
  totals: Partial<Record<string, number>>;
  goals: Record<string, number>;
}

const SUPPORTED_METRICS = new Set<Metric>([
  "calories",
  "protein",
  "carbs",
  "fiber",
  "sugar",
  "sodium",
  "potassium",
  "cholesterol",
  "saturated_fat",
  "iron",
  "vitamin_c",
  "vitamin_d",
  "vitamin_a",
  "calcium",
]);

const CONDITION_ALIASES: Record<string, string> = {
  "celiac disease": "celiac disease",
  "crohn's disease": "crohn's disease",
  "ulcerative colitis": "ulcerative colitis",
  "type 1 diabetes": "type 1 diabetes",
  "type 2 diabetes": "type 2 diabetes",
  hypertension: "hypertension",
  "high cholesterol": "high cholesterol",
  endometriosis: "endometriosis",
  hypothyroidism: "hypothyroidism",
  hyperthyroidism: "hyperthyroidism",
  "kidney disease": "kidney disease",
  osteoporosis: "osteoporosis",
  "iron deficiency anaemia": "iron deficiency anaemia",
  pcos: "pcos",
  pregnancy: "pregnancy",
  "heart disease": "heart disease",
  vegetarian: "vegetarian",
  vegan: "vegan",
  obesity: "obesity",
  ibs: "ibs",
};

const TRACKING_KEY_TO_METRIC: Record<string, Metric | null> = {
  calories: "calories",
  protein: "protein",
  carbohydrates: "carbs",
  carbs: "carbs",
  fiber: "fiber",
  added_sugar: "sugar",
  total_sugar: "sugar",
  sugar: "sugar",
  sodium: "sodium",
  potassium: "potassium",
  cholesterol: "cholesterol",
  saturated_fat: "saturated_fat",
  iron: "iron",
  vitamin_c: "vitamin_c",
  vitamin_d: "vitamin_d",
  vitamin_a_retinol: "vitamin_a",
  vitamin_a: "vitamin_a",
  calcium: "calcium",
  refined_carbs: null,
  low_gi_carbs: null,
  soluble_fiber: null,
  insoluble_fiber: null,
  fodmap: null,
  gluten: null,
  alcohol: null,
  caffeine: null,
  iodine: null,
  zinc: null,
  folate: null,
  vitamin_b12: null,
  b12: null,
  omega_3: null,
  omega3: null,
  magnesium: null,
  selenium: null,
  choline: null,
  mercury_fish: null,
  raw_unpasteurized_food_risk: null,
  phosphorus: null,
  trans_fat: null,
  red_processed_meat: null,
  fruits_vegetables: null,
  spicy_foods: null,
  lactose: null,
};

function normalizeConditionName(condition: string): string {
  return CONDITION_ALIASES[condition.trim().toLowerCase()] ?? condition.trim().toLowerCase();
}

function buildRuleIndex() {
  const index = new Map<string, RuleRow>();
  const rows = Array.isArray((rulesData as any).rules) ? ((rulesData as any).rules as RuleRow[]) : [];
  for (const row of rows) {
    const rawCondition = row.condition_or_goal?.trim().toLowerCase();
    const rawTrackingKey = row.tracking_key?.trim().toLowerCase();
    if (!rawCondition || !rawTrackingKey) continue;
    const condition = CONDITION_ALIASES[rawCondition] ?? rawCondition;
    const metric = TRACKING_KEY_TO_METRIC[rawTrackingKey];
    if (!metric || !SUPPORTED_METRICS.has(metric)) continue;
    const key = `${condition}::${metric}`;
    const prev = index.get(key);
    const nextRank = Number(row.override_rank ?? 0);
    const prevRank = Number(prev?.override_rank ?? -1);
    if (!prev || nextRank >= prevRank) {
      index.set(key, row);
    }
  }
  return index;
}

const RULE_INDEX = buildRuleIndex();

function getMetricTarget(metric: Metric, goals: Record<string, number>): number {
  return goalForMetric(metric, goals as any);
}

function formatMetric(metric: Metric, amount: number): string {
  const meta = METRIC_META[metric];
  const rounded = meta.unit === "kcal" ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded}${meta.unit}`;
}

function evaluateBehavior(behavior: string, consumed: number, target: number): RuleStatus {
  if (!target || target <= 0) return "neutral";
  const pct = (consumed / target) * 100;
  switch (behavior) {
    case "LIMIT_BAD":
      if (pct > 100) return "bad";
      if (pct >= 80) return "caution";
      return "good";
    case "TARGET_GOOD":
      if (pct >= 95) return "good";
      if (pct >= 75) return "caution";
      return "bad";
    case "TARGET_GOOD_WITH_UPPER_CAUTION":
      if (pct > 120) return "bad";
      if (pct > 105) return "caution";
      if (pct >= 95) return "good";
      if (pct >= 75) return "caution";
      return "bad";
    case "RANGE_BALANCED":
    case "CUT_ENERGY":
    case "MAINTAIN_ENERGY":
      if (pct > 115 || pct < 70) return "bad";
      if (pct > 95 || pct < 90) return "caution";
      return "good";
    case "BULK_ENERGY":
    case "RECOVERY_TARGET":
      if (pct >= 95) return "good";
      if (pct >= 75) return "caution";
      return "bad";
    case "CLINICIAN_ONLY":
      return target > 0 ? (pct > 100 ? "bad" : pct >= 85 ? "caution" : "neutral") : "neutral";
    case "STRICT_AVOID":
    case "SYMPTOM_TRIGGER_LIMIT":
      return consumed > 0 ? "bad" : "good";
    case "HYDRATION_TARGET":
      if (pct > 120) return "bad";
      if (pct >= 95) return "good";
      if (pct >= 75) return "caution";
      return "bad";
    default:
      return "neutral";
  }
}

function buildExplanation(condition: string, metric: Metric, behavior: string, consumed: number, target: number, status: RuleStatus) {
  const label = METRIC_META[metric].label.toLowerCase();
  if (status === "neutral") {
    return `${condition}: ${label} needs a more explicit target before Nutri AI can score it confidently.`;
  }
  if (behavior === "LIMIT_BAD" || behavior === "STRICT_AVOID" || behavior === "SYMPTOM_TRIGGER_LIMIT") {
    if (status === "good") return `${condition}: ${label} is still comfortably inside today's safer range.`;
    if (status === "caution") return `${condition}: ${label} is getting close to today's limit.`;
    return `${condition}: ${label} is over the safer range for today.`;
  }
  if (status === "good") return `${condition}: ${label} is on track for today.`;
  if (status === "caution") return `${condition}: ${label} is a little off pace and worth improving.`;
  return `${condition}: ${label} is meaningfully off target today.`;
}

export function evaluateConditionRules({ conditions, totals, goals }: EvaluateArgs): Record<string, EvaluatedConditionMetric[]> {
  const result: Record<string, EvaluatedConditionMetric[]> = {};

  for (const condition of conditions) {
    const normalizedCondition = normalizeConditionName(condition);
    const metrics: EvaluatedConditionMetric[] = [];

    for (const metric of SUPPORTED_METRICS) {
      const row = RULE_INDEX.get(`${normalizedCondition}::${metric}`);
      if (!row) continue;
      const target = getMetricTarget(metric, goals);
      if (!target || target <= 0) continue;
      const consumed = Number(totals[metric] ?? 0);
      const pct = target > 0 ? (consumed / target) * 100 : 0;
      const behavior = row.rule_behavior ?? "TARGET_GOOD";
      const status = evaluateBehavior(behavior, consumed, target);

      metrics.push({
        condition,
        metric,
        label: METRIC_META[metric].label,
        unit: METRIC_META[metric].unit,
        consumed,
        target,
        pct,
        status,
        behavior,
        overrideRank: Number(row.override_rank ?? 0),
        explanation: buildExplanation(condition, metric, behavior, consumed, target, status),
        implementationNote: row.implementation_note,
      });
    }

    if (metrics.length) {
      metrics.sort((a, b) => {
        const statusOrder: Record<RuleStatus, number> = { bad: 0, caution: 1, good: 2, neutral: 3 };
        return statusOrder[a.status] - statusOrder[b.status] || b.overrideRank - a.overrideRank;
      });
      result[condition] = metrics;
    }
  }

  return result;
}

export function summarizeMetricStatuses(
  conditionRules: Record<string, EvaluatedConditionMetric[]>,
): Partial<Record<Metric, MetricStatusSummary>> {
  const summary: Partial<Record<Metric, MetricStatusSummary>> = {};
  const statusOrder: Record<RuleStatus, number> = { bad: 0, caution: 1, good: 2, neutral: 3 };

  for (const [condition, metrics] of Object.entries(conditionRules)) {
    for (const metric of metrics) {
      const existing = summary[metric.metric];
      if (!existing) {
        summary[metric.metric] = {
          metric: metric.metric,
          status: metric.status,
          conditions: [condition],
          explanations: [metric.explanation],
        };
        continue;
      }

      if (statusOrder[metric.status] < statusOrder[existing.status]) {
        summary[metric.metric] = {
          metric: metric.metric,
          status: metric.status,
          conditions: [condition],
          explanations: [metric.explanation],
        };
      } else if (statusOrder[metric.status] === statusOrder[existing.status]) {
        existing.conditions.push(condition);
        existing.explanations.push(metric.explanation);
      }
    }
  }

  return summary;
}
