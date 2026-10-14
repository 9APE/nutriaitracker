import type { ExtendedGoals } from "./nouri-goals";
import type { Meal } from "./nouri-storage";
import { todayISO } from "./nouri-storage";
import type { UserProfile } from "@/components/nouri/ProfileChatOnboarding";

export type AlertLevel = "warning" | "exceeded" | "low";

export interface NutrientAlert {
  id: string;
  nutrient: string;
  label: string;
  unit: string;
  level: AlertLevel;
  consumed: number;
  limit: number;
  remaining: number;
  pct: number;
  message: string;
  advice: string;
}

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturated_fat: number;
  potassium: number;
  calcium: number;
  iron: number;
  vitamin_c: number;
  vitamin_d: number;
  vitamin_a: number;
}

export function computeDayTotals(meals: Meal[], date?: string): DayTotals {
  const today = date ?? todayISO();
  return meals
    .filter((m) => m.date === today)
    .reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
        fiber: acc.fiber + (m.micros?.fiber ?? 0),
        sugar: acc.sugar + (m.micros?.sugar ?? 0),
        sodium: acc.sodium + (m.micros?.sodium ?? 0),
        cholesterol: acc.cholesterol + (m.micros?.cholesterol ?? 0),
        saturated_fat: acc.saturated_fat + (m.micros?.saturated_fat ?? 0),
        potassium: acc.potassium + (m.micros?.potassium ?? 0),
        calcium: acc.calcium + (m.micros?.calcium ?? 0),
        iron: acc.iron + (m.micros?.iron ?? 0),
        vitamin_c: acc.vitamin_c + (m.micros?.vitamin_c ?? 0),
        vitamin_d: acc.vitamin_d + (m.micros?.vitamin_d ?? 0),
        vitamin_a: acc.vitamin_a + (m.micros?.vitamin_a ?? 0),
      }),
      {
        calories: 0, protein: 0, carbs: 0, fat: 0,
        fiber: 0, sugar: 0, sodium: 0, cholesterol: 0, saturated_fat: 0,
        potassium: 0, calcium: 0, iron: 0, vitamin_c: 0, vitamin_d: 0, vitamin_a: 0,
      }
    );
}

//  Static advice table 

const ADVICE: Record<string, Partial<Record<AlertLevel, string>>> = {
  sugar: {
    warning: "Skip desserts and sweet drinks for the rest of today",
    exceeded: "Choose water, unsweetened tea, or plain yogurt",
  },
  sodium: {
    warning: "Avoid processed snacks and condiments tonight",
    exceeded: "Drink water; pick fresh fruit, plain rice, or unsalted nuts",
  },
  saturated_fat: {
    warning: "Swap red meat or butter for fish or olive oil tonight",
    exceeded: "Pick lean protein and veg; skip cheese and fried food",
  },
  cholesterol: {
    warning: "Limit egg yolks and full-fat dairy for the rest of today",
    exceeded: "Choose plant proteins, white fish, or legumes",
  },
  carbs: {
    warning: "Limit bread, rice, and pasta for the rest of today",
    exceeded: "Choose non-starchy veg, lean protein, and healthy fats",
  },
  fiber: { low: "Add a salad, lentils, or a piece of fruit" },
  protein: { low: "Add Greek yogurt, eggs, or a chicken breast" },
  potassium: { low: "Eat a banana, sweet potato, or avocado" },
  calcium: { low: "Add dairy, fortified plant milk, or leafy greens" },
  iron: { low: "Eat lentils, spinach, or lean red meat with vitamin C" },
  vitamin_c: { low: "Add citrus fruit, bell peppers, or kiwi" },
  vitamin_d: { low: "Eat salmon, eggs, or fortified foods" },
  vitamin_a: { low: "Add carrots, sweet potato, or leafy greens" },
};

//  Nutrient definitions 

interface StayUnder {
  key: keyof DayTotals;
  goalKey: keyof ExtendedGoals;
  label: string;
  unit: string;
}

interface HitTarget {
  key: keyof DayTotals;
  goalKey: keyof ExtendedGoals;
  label: string;
  unit: string;
}

const STAY_UNDER: StayUnder[] = [
  { key: "sugar",         goalKey: "sugar_max",         label: "Sugar",          unit: "g"   },
  { key: "saturated_fat", goalKey: "saturated_fat_max", label: "Saturated fat",  unit: "g"   },
  { key: "sodium",        goalKey: "sodium_max",        label: "Sodium",         unit: "mg"  },
  { key: "cholesterol",   goalKey: "cholesterol_max",   label: "Cholesterol",    unit: "mg"  },
];

const HIT_TARGET: HitTarget[] = [
  { key: "fiber",     goalKey: "fiber",     label: "Fiber",     unit: "g"   },
  { key: "protein",   goalKey: "protein",   label: "Protein",   unit: "g"   },
  { key: "potassium", goalKey: "potassium", label: "Potassium", unit: "mg"  },
  { key: "calcium",   goalKey: "calcium",   label: "Calcium",   unit: "mg"  },
  { key: "iron",      goalKey: "iron",      label: "Iron",      unit: "mg"  },
  { key: "vitamin_c", goalKey: "vitamin_c", label: "Vitamin C", unit: "mg"  },
  { key: "vitamin_d", goalKey: "vitamin_d", label: "Vitamin D", unit: "mcg" },
  { key: "vitamin_a", goalKey: "vitamin_a", label: "Vitamin A", unit: "mcg" },
];

//  Core computation 

export function computeNutrientAlerts(
  totals: DayTotals,
  goals: ExtendedGoals,
  userProfile: UserProfile | null,
): NutrientAlert[] {
  const alerts: NutrientAlert[] = [];
  const hourNow = new Date().getHours();
  const isPastSixPm = hourNow >= 18;

  // "Stay under" limits
  for (const n of STAY_UNDER) {
    const limit = goals[n.goalKey] as number | undefined;
    if (!limit || limit <= 0) continue;
    const consumed = totals[n.key] as number;
    if (consumed <= 0) continue;
    const pct = (consumed / limit) * 100;
    const remaining = limit - consumed;

    if (pct >= 100) {
      alerts.push({
        id: `${n.key}-exceeded`,
        nutrient: n.key,
        label: n.label,
        unit: n.unit,
        level: "exceeded",
        consumed,
        limit,
        remaining: 0,
        pct,
        message: `Over ${n.label.toLowerCase()} limit by ${Math.round(Math.abs(remaining))}${n.unit}`,
        advice: ADVICE[n.key]?.exceeded ?? `Avoid high-${n.key.replace("_", " ")} foods today`,
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `${n.key}-warning`,
        nutrient: n.key,
        label: n.label,
        unit: n.unit,
        level: "warning",
        consumed,
        limit,
        remaining,
        pct,
        message: `Only ${Math.round(remaining)}${n.unit} ${n.label.toLowerCase()} left today`,
        advice: ADVICE[n.key]?.warning ?? `Watch your ${n.label.toLowerCase()} intake`,
      });
    }
  }

  // Carb warning  only for weight-loss / low-carb goals
  const goalText = userProfile?.goals?.toLowerCase() ?? "";
  const isLowCarb =
    goalText.includes("weight") || goalText.includes("lose") ||
    goalText.includes("keto") || goalText.includes("low carb");
  if (isLowCarb && goals.carbs > 0) {
    const consumed = totals.carbs;
    const pct = (consumed / goals.carbs) * 100;
    const remaining = goals.carbs - consumed;
    if (pct >= 100) {
      alerts.push({
        id: "carbs-exceeded",
        nutrient: "carbs",
        label: "Carbs",
        unit: "g",
        level: "exceeded",
        consumed,
        limit: goals.carbs,
        remaining: 0,
        pct,
        message: `Over carb goal by ${Math.round(Math.abs(remaining))}g`,
        advice: ADVICE.carbs.exceeded ?? "Choose non-starchy veg and lean protein",
      });
    } else if (pct >= 80) {
      alerts.push({
        id: "carbs-warning",
        nutrient: "carbs",
        label: "Carbs",
        unit: "g",
        level: "warning",
        consumed,
        limit: goals.carbs,
        remaining,
        pct,
        message: `Only ${Math.round(remaining)}g carbs left today`,
        advice: ADVICE.carbs.warning ?? "Limit bread, rice, pasta tonight",
      });
    }
  }

  // "Hit target" minimums  only shown after 6 pm
  if (isPastSixPm) {
    for (const n of HIT_TARGET) {
      const target = goals[n.goalKey] as number | undefined;
      if (!target || target <= 0) continue;
      const consumed = totals[n.key] as number;
      const pct = (consumed / target) * 100;
      if (pct < 60) {
        alerts.push({
          id: `${n.key}-low`,
          nutrient: n.key,
          label: n.label,
          unit: n.unit,
          level: "low",
          consumed,
          limit: target,
          remaining: target - consumed,
          pct,
          message: `Only ${Math.round(pct)}% of ${n.label.toLowerCase()} goal met`,
          advice: ADVICE[n.key]?.low ?? `Get more ${n.label.toLowerCase()} before bed`,
        });
      }
    }
  }

  const order: Record<AlertLevel, number> = { exceeded: 0, warning: 1, low: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
