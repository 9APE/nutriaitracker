import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MealCard } from "./MealCard";
import type { Meal } from "@/lib/nouri-storage";
import { useLanguage, t, getLocale } from "@/lib/nouri-i18n";

interface HistoryScreenProps {
  meals: Meal[];
  onDelete: (id: string) => void;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function HistoryScreen({ meals, onDelete }: HistoryScreenProps) {
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
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto">
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

// ── Calendar overlay ─────────────────────────────────────────────────────────
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
    // Monday Jan 4 1971 — known Monday
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
    // JS getDay: Sun=0..Sat=6 → convert to Mon=0..Sun=6
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
