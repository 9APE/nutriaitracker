import { useEffect, useState } from "react";
import { MacroBar } from "@/components/nouri/MacroBar";
import { MealCard } from "@/components/nouri/MealCard";
import { NouriRecommends } from "@/components/nouri/NouriRecommends";
import { RemainingBanner } from "@/components/nouri/RemainingBanner";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { getStreak } from "@/lib/nouri-streak";
import { Mic } from "lucide-react";

interface TodayScreenProps {
  goals: Goals;
  meals: Meal[];
  onDeleteMeal: (id: string) => void;
  onGoLog: () => void;
  onPickSuggestion?: (mealName: string) => void;
}

export function TodayScreen({ goals, meals, onDeleteMeal, onGoLog, onPickSuggestion }: TodayScreenProps) {
  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);
  const sum = todayMeals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const remaining = Math.max(0, goals.calories - sum.calories);
  const calPct = Math.min(100, (sum.calories / goals.calories) * 100);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [streak, setStreak] = useState(() => getStreak());
  useEffect(() => {
    const refresh = () => setStreak(getStreak());
    refresh();
    window.addEventListener("streak:updated", refresh);
    return () => window.removeEventListener("streak:updated", refresh);
  }, [meals]);

  const streakActive =
    streak.count > 0 &&
    (streak.lastLogDate === today ||
      streak.lastLogDate ===
        (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return d.toISOString().slice(0, 10);
        })());

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Today</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-medium">{dateLabel}</h1>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
            style={{ backgroundColor: "#EAF4EE", borderColor: "#5BB882", color: "#1F6B43" }}
            title="Daily logging streak"
          >
            {streakActive ? `🔥 ${streak.count}` : "🔥 Start your streak!"}
          </span>
        </div>
      </div>

      <section className="nouri-card p-6">
        <div className="flex items-end justify-between mb-1">
          <div>
            <div className="font-mono-data text-5xl text-foreground leading-none">
              {Math.round(sum.calories)}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Calories eaten</div>
          </div>
          <div className="text-right">
            <div className="font-mono-data text-2xl text-primary leading-none">
              {Math.round(remaining)}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Remaining</div>
          </div>
        </div>
        <div className="mt-5 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary macro-fill rounded-full"
            style={{ width: `${calPct}%` }}
          />
        </div>
        <div className="font-mono-data text-[11px] text-muted-foreground mt-2 text-right">
          Goal {goals.calories} kcal
        </div>
      </section>

      <section className="nouri-card p-5 space-y-4">
        <MacroBar label="Protein" emoji="💪" current={sum.protein} goal={goals.protein} color="protein" />
        <MacroBar label="Carbs" emoji="🌾" current={sum.carbs} goal={goals.carbs} color="carbs" />
        <MacroBar label="Fat" emoji="🫒" current={sum.fat} goal={goals.fat} color="fat" />
      </section>

      <RemainingBanner
        remainingProtein={goals.protein - sum.protein}
        remainingCalories={goals.calories - sum.calories}
      />

      <button
        onClick={onGoLog}
        className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors py-5 px-4 flex items-center justify-center gap-2 text-primary font-medium"
      >
        <Mic size={18} />
        Log a meal with voice or text 🎤
      </button>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-medium px-1">Today's meals</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-4">
            Nothing logged yet — tap the button above to add your first meal.
          </p>
        ) : (
          <div className="space-y-2">
            {todayMeals.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={onDeleteMeal} />
            ))}
          </div>
        )}
      </section>

      <NouriRecommends
        goals={goals}
        meals={meals}
        onPick={(name) => onPickSuggestion?.(name)}
      />
    </div>
  );
}
