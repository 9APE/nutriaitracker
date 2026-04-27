import type { Goals, Meal } from "@/lib/nouri-storage";
import { Check } from "lucide-react";

interface InsightsScreenProps {
  meals: Meal[];
  goals: Goals;
}

function last7Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function InsightsScreen({ meals, goals }: InsightsScreenProps) {
  const days = last7Days();
  const today = days[days.length - 1];

  const byDay = days.map((date) => {
    const dayMeals = meals.filter((m) => m.date === date);
    const calories = dayMeals.reduce((s, m) => s + m.calories, 0);
    const protein = dayMeals.reduce((s, m) => s + m.protein, 0);
    return { date, calories, protein, hasData: dayMeals.length > 0 };
  });

  const daysWithData = byDay.filter((d) => d.hasData);
  const avgCal = daysWithData.length
    ? daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length
    : 0;
  const avgProt = daysWithData.length
    ? daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length
    : 0;

  const maxCal = Math.max(goals.calories, ...byDay.map((d) => d.calories), 1);
  const maxProt = Math.max(goals.protein, ...byDay.map((d) => d.protein), 1);

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto space-y-5">
      <h1 className="font-serif text-2xl font-medium">Insights</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Avg Protein / day"
          value={`${Math.round(avgProt)}g`}
          tone="protein"
        />
        <StatCard
          label="Avg Calories / day"
          value={`${Math.round(avgCal)}`}
          unit="kcal"
          tone="calories"
        />
      </div>

      <ChartCard
        title="Calories — last 7 days"
        goalLine={`Goal · ${goals.calories} kcal`}
      >
        <BarChart
          data={byDay}
          accessor={(d) => d.calories}
          max={maxCal}
          today={today}
          colorClass="bg-macro-calories"
          formatValue={(v) => `${Math.round(v)}`}
        />
      </ChartCard>

      <ChartCard
        title="Protein — last 7 days"
        goalLine={`Goal · ${goals.protein}g`}
      >
        <BarChart
          data={byDay}
          accessor={(d) => d.protein}
          max={maxProt}
          today={today}
          colorClass="bg-macro-protein"
          formatValue={(v) => `${Math.round(v)}`}
          checkMark={(d) => d.protein >= goals.protein}
        />
      </ChartCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "protein" | "calories";
}) {
  const bg = tone === "protein" ? "bg-macro-protein/10" : "bg-primary-soft";
  return (
    <div className={`nouri-card p-4 ${bg}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono-data text-2xl text-foreground mt-1">
        {value}
        {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  goalLine,
  children,
}: {
  title: string;
  goalLine: string;
  children: React.ReactNode;
}) {
  return (
    <section className="nouri-card p-5">
      <h2 className="font-serif text-base font-medium mb-4">{title}</h2>
      {children}
      <p className="text-[11px] text-muted-foreground mt-3 font-mono-data">{goalLine}</p>
    </section>
  );
}

interface BarChartProps {
  data: { date: string; calories: number; protein: number; hasData: boolean }[];
  accessor: (d: BarChartProps["data"][number]) => number;
  max: number;
  today: string;
  colorClass: string;
  formatValue: (v: number) => string;
  checkMark?: (d: BarChartProps["data"][number]) => boolean;
}

function BarChart({ data, accessor, max, today, colorClass, formatValue, checkMark }: BarChartProps) {
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d) => {
        const val = accessor(d);
        const h = max > 0 ? (val / max) * 100 : 0;
        const isToday = d.date === today;
        const showCheck = checkMark?.(d);
        const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
          weekday: "short",
        }).slice(0, 2);

        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="font-mono-data text-[10px] text-muted-foreground h-3">
              {val > 0 ? formatValue(val) : ""}
            </div>
            <div className="w-full h-20 flex items-end relative">
              <div
                className={`${isToday ? "bg-primary" : colorClass + " opacity-60"} w-full rounded-t-md macro-fill`}
                style={{ height: `${h}%`, minHeight: val > 0 ? 4 : 0 }}
              />
              {showCheck && val > 0 && (
                <Check
                  size={10}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 text-primary bg-surface rounded-full p-[1px]"
                />
              )}
            </div>
            <div className={`text-[10px] ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {dayLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}
