import { MealCard } from "./MealCard";
import type { Meal } from "@/lib/nouri-storage";

interface HistoryScreenProps {
  meals: Meal[];
  onDelete: (id: string) => void;
}

export function HistoryScreen({ meals, onDelete }: HistoryScreenProps) {
  const groups = new Map<string, Meal[]>();
  for (const m of meals) {
    const arr = groups.get(m.date) ?? [];
    arr.push(m);
    groups.set(m.date, arr);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto">
      <h1 className="font-serif text-2xl font-medium mb-5">History</h1>

      {dates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meals logged yet.</p>
      ) : (
        <div className="space-y-7">
          {dates.map((date) => {
            const items = groups.get(date)!;
            const totals = items.reduce(
              (a, m) => ({
                calories: a.calories + m.calories,
                protein: a.protein + m.protein,
              }),
              { calories: 0, protein: 0 }
            );
            const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });
            return (
              <section key={date}>
                <h2 className="font-serif text-base font-medium mb-2 px-1">{label}</h2>
                <div className="space-y-2">
                  {items.map((m) => (
                    <MealCard key={m.id} meal={m} onDelete={onDelete} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1 pt-2 border-t border-border/60">
                  <span className="font-mono-data">{Math.round(totals.calories)} kcal</span>
                  <span className="font-mono-data">{Math.round(totals.protein)}g protein</span>
                  <span>{items.length} meals</span>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
