import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MealCard } from "./MealCard";
import type { Meal, MealMicros, Goals } from "@/lib/nouri-storage";
import { useLanguage, t, getLocale } from "@/lib/nouri-i18n";

interface HistoryScreenProps {
  meals: Meal[];
  goals?: Goals;
  onDelete: (id: string) => void;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Renders only the date-grouped meal list  no header, no calendar, last 14 days. */
export function MealHistoryList({ meals, onDelete }: { meals: Meal[]; onDelete: (id: string) => void }) {
  const lang = useLanguage();
  const locale = getLocale(lang);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return toISO(d);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Meal[]>();
    for (const meal of meals) {
      if (meal.date < cutoff) continue;
      const arr = m.get(meal.date) ?? [];
      arr.push(meal);
      m.set(meal.date, arr);
    }
    return m;
  }, [meals, cutoff]);

  const visibleDates = useMemo(
    () => [...groups.keys()].sort((a, b) => (a < b ? 1 : -1)),
    [groups]
  );

  const formatLong = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale, {
      weekday: "long", month: "long", day: "numeric",
    });

  if (visibleDates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noMealsLogged", lang)}</p>;
  }

  return (
    <div className="space-y-7">
      {visibleDates.map((date) => {
        const items = groups.get(date)!;
        const totals = items.reduce(
          (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein }),
          { calories: 0, protein: 0 }
        );
        return (
          <section key={date}>
            <h3 className="font-serif text-base font-medium mb-2 px-1">{formatLong(date)}</h3>
            <div className="space-y-2">
              {items.map((m) => <MealCard key={m.id} meal={m} onDelete={onDelete} />)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1 pt-2 border-t border-border/60">
              <span className="font-mono-data">{Math.round(totals.calories)} {t("kcalShort", lang)}</span>
              <span className="font-mono-data">{Math.round(totals.protein)}{t("gShort", lang)} {t("proteinShort", lang)}</span>
              <span>{t("mealsCount", lang, { n: items.length })}</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function HistoryScreen({ meals, goals, onDelete }: HistoryScreenProps) {
  const lang = useLanguage();
  const locale = getLocale(lang);
  const [showCal, setShowCal] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);

  // Group all meals by date
  const groups = useMemo(() => {
    const m = new Map<string, Meal[]>();
    for (const meal of meals) {
      const arr = m.get(meal.date) ?? [];
      arr.push(meal);
      m.set(meal.date, arr);
    }
    return m;
  }, [meals]);

  const datesWithMeals = useMemo(() => new Set(groups.keys()), [groups]);

  const visibleDates = useMemo(() => {
    const all = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));
    return filterDate ? all.filter((d) => d === filterDate) : all;
  }, [groups, filterDate]);

  const formatLong = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="px-5 pt-4 pb-36 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-2xl font-medium">{t("historyTitle", lang)}</h1>
        <button
          onClick={() => setShowCal(true)}
          aria-label="Open calendar"
          className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <CalendarIcon size={20} />
        </button>
      </div>

      {filterDate && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5">
          <span className="text-sm text-foreground">
            Showing <span className="font-medium">{formatLong(filterDate)}</span>
          </span>
          <button
            onClick={() => setFilterDate(null)}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
      )}

      {visibleDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filterDate ? "No meals logged on this day." : t("noMealsLogged", lang)}
        </p>
      ) : (
        <div className="space-y-7">
          {visibleDates.map((date) => {
            const items = groups.get(date)!;
            const totals = items.reduce(
              (a, m) => ({
                calories: a.calories + m.calories,
                protein: a.protein + m.protein,
              }),
              { calories: 0, protein: 0 },
            );
            return (
              <section key={date}>
                <h2 className="font-serif text-base font-medium mb-2 px-1">{formatLong(date)}</h2>
                <div className="space-y-2">
                  {items.map((m) => (
                    <MealCard key={m.id} meal={m} onDelete={onDelete} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1 pt-2 border-t border-border/60">
                  <span className="font-mono-data">
                    {Math.round(totals.calories)} {t("kcalShort", lang)}
                  </span>
                  <span className="font-mono-data">
                    {Math.round(totals.protein)}
                    {t("gShort", lang)} {t("proteinShort", lang)}
                  </span>
                  <span>{t("mealsCount", lang, { n: items.length })}</span>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <NutrientTrends meals={meals} goals={goals} />

      {showCal && (
        <CalendarOverlay
          locale={locale}
          datesWithMeals={datesWithMeals}
          onClose={() => setShowCal(false)}
          onPick={(iso) => {
            setFilterDate(iso);
            setShowCal(false);
          }}
        />
      )}
    </div>
  );
}

//  Calendar overlay 
function CalendarOverlay({
  locale,
  datesWithMeals,
  onClose,
  onPick,
}: {
  locale: string;
  datesWithMeals: Set<string>;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const today = todayISO();
  const initial = new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  // Build weekday headers starting Monday
  const weekdayLabels = useMemo(() => {
    // Monday Jan 4 1971  known Monday
    const base = new Date(1971, 0, 4);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "narrow" });
    });
  }, [locale]);

  // Build cells: pad start (Mon=0) and fill month days
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    // JS getDay: Sun=0..Sat=6  convert to Mon=0..Sun=6
    const startOffset = (first.getDay() + 6) % 7;
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      arr.push(new Date(cursor.year, cursor.month, day));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const goPrev = () => {
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
    );
  };
  const goNext = () => {
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-5"
      onClick={onClose}
      role="dialog"
      aria-label="Pick a date"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-background rounded-3xl border border-border shadow-card p-5 animate-bubble-in"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goPrev}
            aria-label="Previous month"
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-base font-medium capitalize">{monthLabel}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={goNext}
              aria-label="Next month"
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {weekdayLabels.map((w, i) => (
            <div key={i} className="text-[11px] font-medium text-muted-foreground text-center py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const iso = toISO(d);
            const isToday = iso === today;
            const hasMeals = datesWithMeals.has(iso);
            return (
              <button
                key={i}
                onClick={() => onPick(iso)}
                className={`relative aspect-square flex items-center justify-center rounded-full text-sm transition-colors ${
                  isToday
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
                aria-label={d.toLocaleDateString(locale, { dateStyle: "full" })}
              >
                {d.getDate()}
                {hasMeals && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      isToday ? "bg-primary-foreground" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Tap a date to filter your history
        </p>
      </div>
    </div>
  );
}

//  Nutrient trends (last 30 days) 

type TrendNutrient = {
  key: "calories" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium";
  label: string;
  unit: string;
  direction: "atLeast" | "atMost";
  defaultGoal: number;
  stroke: string;
};

const TREND_NUTRIENTS: TrendNutrient[] = [
  { key: "calories", label: "Calories", unit: "kcal", direction: "atLeast", defaultGoal: 2500, stroke: "hsl(var(--macro-calories))" },
  { key: "protein",  label: "Protein",  unit: "g",    direction: "atLeast", defaultGoal: 150,  stroke: "hsl(var(--macro-protein))" },
  { key: "carbs",    label: "Carbs",    unit: "g",    direction: "atLeast", defaultGoal: 200,  stroke: "hsl(var(--macro-carbs))" },
  { key: "fat",      label: "Fat",      unit: "g",    direction: "atLeast", defaultGoal: 70,   stroke: "hsl(var(--macro-fat))" },
  { key: "fiber",    label: "Fiber",    unit: "g",    direction: "atLeast", defaultGoal: 30,   stroke: "hsl(160 60% 45%)" },
  { key: "sugar",    label: "Sugar",    unit: "g",    direction: "atMost",  defaultGoal: 50,   stroke: "hsl(330 70% 60%)" },
  { key: "sodium",   label: "Sodium",   unit: "mg",   direction: "atMost",  defaultGoal: 2300, stroke: "hsl(38 90% 55%)" },
];

function valueOf(meal: Meal, key: TrendNutrient["key"]): number {
  if (key === "calories" || key === "protein" || key === "carbs" || key === "fat") {
    return meal[key] ?? 0;
  }
  const m: MealMicros = meal.micros ?? {};
  return (m as any)[key] ?? 0;
}

function NutrientTrends({ meals, goals }: { meals: Meal[]; goals?: Goals }) {
  const days = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(toISO(d));
    }
    return out;
  }, []);

  const series = useMemo(() => {
    return TREND_NUTRIENTS.map((n) => {
      const values = days.map((date) => {
        const day = meals.filter((m) => m.date === date);
        return day.reduce((s, m) => s + valueOf(m, n.key), 0);
      });
      const daysWithData = values.filter((v) => v > 0);
      const avg = daysWithData.length
        ? daysWithData.reduce((s, v) => s + v, 0) / daysWithData.length
        : 0;
      const goal = goals && (n.key in goals) ? (goals as any)[n.key] : n.defaultGoal;
      return { ...n, values, avg, goal, today: values[values.length - 1] };
    });
  }, [meals, days, goals]);

  if (meals.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-base font-medium mb-3 px-1">Nutrient trends  30 days</h2>
      <div className="space-y-2">
        {series.map((s) => (
          <div key={s.key} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium leading-tight">{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                avg <span className="font-mono-data text-foreground">{Math.round(s.avg)}</span>
                <span className="mx-1"></span>
                goal {s.direction === "atMost" ? "" : ""}{Math.round(s.goal)} {s.unit}
              </div>
            </div>
            <Sparkline values={s.values} goal={s.goal} stroke={s.stroke} />
            <div className="w-12 text-right font-mono-data text-xs">
              {Math.round(s.today)}
              <div className="text-[9px] text-muted-foreground font-sans">today</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Sparkline({ values, goal, stroke }: { values: number[]; goal: number; stroke: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(goal * 1.1, ...values, 1);
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  const goalY = h - (goal / max) * h;
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      {goal > 0 && goalY >= 0 && goalY <= h && (
        <line
          x1={0} x2={w} y1={goalY} y2={goalY}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.5}
          strokeDasharray="2 2"
          strokeWidth={1}
        />
      )}
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
