import type { Goals, Meal, MealMicros } from "@/lib/nouri-storage";
import { useLanguage, getLocale, type LangCode } from "@/lib/nouri-i18n";

interface InsightsScreenProps {
  meals: Meal[];
  goals: Goals;
  compact?: boolean;
}

type Nutrient = {
  key: "calories" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium";
  label: string;
  unit: string;
  direction: "atLeast" | "atMost";
  colorClass: string;
};

const NUTRIENTS: Nutrient[] = [
  { key: "calories", label: "Calories", unit: "kcal", direction: "atLeast", colorClass: "bg-macro-calories" },
  { key: "protein", label: "Protein", unit: "g", direction: "atLeast", colorClass: "bg-macro-protein" },
  { key: "carbs", label: "Carbs", unit: "g", direction: "atLeast", colorClass: "bg-macro-carbs" },
  { key: "fat", label: "Fat", unit: "g", direction: "atLeast", colorClass: "bg-macro-fat" },
  { key: "fiber", label: "Fiber", unit: "g", direction: "atLeast", colorClass: "bg-emerald-500" },
  { key: "sugar", label: "Sugar", unit: "g", direction: "atMost", colorClass: "bg-pink-500" },
  { key: "sodium", label: "Sodium", unit: "mg", direction: "atMost", colorClass: "bg-amber-500" },
];

const MICRO_DEFAULTS: Record<string, number> = {
  fiber: 30,
  sugar: 50,
  sodium: 2300,
};

function goalFor(n: Nutrient, goals: Goals): number {
  if (n.key in goals) return Number((goals as unknown as Record<string, number>)[n.key] ?? 0);
  return MICRO_DEFAULTS[n.key] ?? 0;
}

function valueFor(meal: Meal, key: Nutrient["key"]): number {
  if (key === "calories" || key === "protein" || key === "carbs" || key === "fat") {
    return meal[key] ?? 0;
  }
  const micros: MealMicros = meal.micros ?? {};
  return Number((micros as unknown as Record<string, number>)[key] ?? 0);
}

function last7Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function InsightChartList({ meals, goals, compact = false }: InsightsScreenProps) {
  const lang = useLanguage();
  const days = last7Days();
  const today = days[days.length - 1];

  return (
    <div className="space-y-3">
      {NUTRIENTS.map((n) => {
        const goal = goalFor(n, goals);
        const byDay = days.map((date) => {
          const dayMeals = meals.filter((m) => m.date === date);
          const value = dayMeals.reduce((s, m) => s + valueFor(m, n.key), 0);
          return { date, value, hasData: dayMeals.length > 0 };
        });
        return (
          <NutrientCard
            key={n.key}
            nutrient={n}
            goal={goal}
            today={today}
            todayValue={byDay[byDay.length - 1].value}
            data={byDay}
            lang={lang}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

export function InsightsScreen({ meals, goals }: InsightsScreenProps) {
  return (
    <div className="px-5 pt-4 pb-36 max-w-md mx-auto space-y-4">
      <h1 className="font-serif text-2xl font-medium">Insights</h1>
      <p className="text-xs text-muted-foreground -mt-2">
        Last 7 days  dashed line is your daily goal
      </p>
      <InsightChartList meals={meals} goals={goals} />
    </div>
  );
}

function NutrientCard({
  nutrient,
  goal,
  today,
  todayValue,
  data,
  lang,
  compact,
}: {
  nutrient: Nutrient;
  goal: number;
  today: string;
  todayValue: number;
  data: { date: string; value: number; hasData: boolean }[];
  lang: LangCode;
  compact: boolean;
}) {
  const max = Math.max(goal * 1.1, ...data.map((d) => d.value), 1);
  const pctOfGoal = goal > 0 ? Math.round((todayValue / goal) * 100) : 0;
  const goalMet =
    nutrient.direction === "atLeast" ? todayValue >= goal : todayValue <= goal;
  const avgValue = Math.round(
    data.reduce((sum, item) => sum + item.value, 0) / Math.max(data.length, 1),
  );
  const loggedDays = data.filter((item) => item.hasData).length;

  return (
    <section
      className={`rounded-[24px] border p-4 ${
        goalMet ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-border bg-card"
      }`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {nutrient.label}
          </div>
          <h2 className="font-serif text-lg font-medium leading-tight mt-1">
            {Math.round(todayValue)} {nutrient.unit}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Goal {nutrient.direction === "atMost" ? "" : ""}
            {Math.round(goal)} {nutrient.unit}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-[11px] font-medium ${
              goalMet ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {pctOfGoal}% of goal
          </div>
          <div className="mt-2 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground">
            Avg {avgValue} {nutrient.unit}
          </div>
        </div>
      </header>

      <BarChart
        data={data}
        max={max}
        goal={goal}
        today={today}
        colorClass={nutrient.colorClass}
        lang={lang}
      />

      {!compact && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{goalMet ? "On track today" : "Below target today"}</span>
          <span>{loggedDays}/7 days logged</span>
        </div>
      )}
    </section>
  );
}

function BarChart({
  data,
  max,
  goal,
  today,
  colorClass,
  lang,
}: {
  data: { date: string; value: number; hasData: boolean }[];
  max: number;
  goal: number;
  today: string;
  colorClass: string;
  lang: LangCode;
}) {
  const locale = getLocale(lang);
  const goalPct = max > 0 ? (goal / max) * 100 : 0;

  return (
    <div className="relative">
      <div className="relative h-24 mb-1">
        {goal > 0 && goalPct <= 100 && (
          <div
            className="absolute inset-x-0 z-10 pointer-events-none border-t border-dashed border-foreground/40"
            style={{ bottom: `${goalPct}%` }}
            aria-hidden
          >
            <span className="absolute -top-3 right-0 text-[9px] text-muted-foreground bg-card px-1 rounded">
              goal
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-end justify-between gap-1.5">
          {data.map((d) => {
            const h = max > 0 ? (d.value / max) * 100 : 0;
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                className="flex-1 h-full flex items-end"
                title={`${Math.round(d.value)}`}
              >
                <div
                  className={`${isToday ? "bg-primary" : `${colorClass} opacity-55`} w-full rounded-t-md transition-[height] duration-300`}
                  style={{ height: `${h}%`, minHeight: d.value > 0 ? 3 : 0 }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        {data.map((d) => {
          const isToday = d.date === today;
          const dayLabel = new Date(`${d.date}T00:00:00`)
            .toLocaleDateString(locale, { weekday: "short" })
            .slice(0, 2);
          return (
            <div
              key={d.date}
              className={`flex-1 text-center text-[10px] ${
                isToday ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {dayLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
