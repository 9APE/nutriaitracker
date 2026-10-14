import { useState } from "react";
import { Loader2, Clock, Check } from "lucide-react";
import type { Meal, MealType } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { useAddMeal, useAddMeals } from "@/hooks/queries/useMeals";
import { recordMealLogged } from "@/lib/nouri-streak";
import { toast } from "sonner";

interface FrequentMeal extends Meal {
  frequency: number;
}

function getFrequentMeals(allMeals: Meal[], limit = 8): FrequentMeal[] {
  const frequency: Record<string, { meal: Meal; count: number }> = {};
  allMeals.forEach((meal) => {
    const key = meal.meal_name.toLowerCase();
    if (frequency[key]) {
      frequency[key].count++;
    } else {
      frequency[key] = { meal, count: 1 };
    }
  });
  return Object.values(frequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({ ...item.meal, frequency: item.count }));
}

function getMealEmoji(type: MealType): string {
  return { Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙", Snack: "🍎" }[type] ?? "🍽️";
}

function formatRelativeDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString();
}

interface ConfirmSheetProps {
  meal: FrequentMeal;
  onClose: () => void;
  onConfirm: (meal: FrequentMeal, type: MealType) => void;
  isPending: boolean;
}

function ConfirmSheet({ meal, onClose, onConfirm, isPending }: ConfirmSheetProps) {
  const [mealType, setMealType] = useState<MealType>(meal.type);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-background rounded-t-3xl p-5 border-t border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-4" />
        <div className="font-bold text-lg mb-0.5">{meal.meal_name}</div>
        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
          <Clock size={11} /> Last logged: {formatRelativeDate(meal.date)}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "kcal", value: meal.calories },
            { label: "protein", value: meal.protein },
            { label: "carbs", value: meal.carbs },
            { label: "fat", value: meal.fat },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted rounded-xl p-2 text-center">
              <div className="font-semibold text-sm">{value}</div>
              <div className="text-[10px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as MealType[]).map((type) => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                ${mealType === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
            >
              {type}
            </button>
          ))}
        </div>

        <button
          onClick={() => onConfirm(meal, mealType)}
          disabled={isPending}
          className="w-full bg-primary text-primary-foreground rounded-xl p-4 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Log it 
        </button>
      </div>
    </div>
  );
}

interface FullHistoryProps {
  meals: Meal[];
  onSelect: (meal: FrequentMeal) => void;
  onLogMany: (meals: FrequentMeal[]) => Promise<void>;
  isPending: boolean;
  onClose: () => void;
}

function FullHistory({ meals, onSelect, onLogMany, isPending, onClose }: FullHistoryProps) {
  const [search, setSearch] = useState("");
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const all = getFrequentMeals(meals, 100);
  const filtered = search
    ? all.filter((m) => m.meal_name.toLowerCase().includes(search.toLowerCase()))
    : all;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={onClose} className="text-sm text-muted-foreground"> Back</button>
        <h2 className="font-semibold flex-1">Meal History</h2>
        <button
          onClick={() => { setMulti((v) => !v); setPicked([]); }}
          className="text-sm text-primary font-semibold"
        >
          {multi ? "Cancel" : "Select multiple"}
        </button>
      </div>
      <div className="px-4 pt-3 pb-2">
        <input
          type="text"
          placeholder="Search meals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-border rounded-xl p-3 text-sm bg-background"
        />
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtered.map((meal) => (
          <button
            key={meal.id}
            onClick={() => {
              if (!multi) return onSelect(meal);
              setPicked((p) => (p.includes(meal.id) ? p.filter((id) => id !== meal.id) : [...p, meal.id]));
            }}
            aria-pressed={multi ? picked.includes(meal.id) : undefined}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {multi && (
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${picked.includes(meal.id) ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                  {picked.includes(meal.id) && <Check size={12} />}
                </span>
              )}
              <span className="text-lg">{getMealEmoji(meal.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{meal.meal_name}</div>
                <div className="text-xs text-muted-foreground">{meal.calories} kcal  {meal.protein}g P  {meal.frequency}</div>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No meals found</p>
        )}
      </div>
      {multi && picked.length > 0 && (
        <div className="p-4 border-t border-border">
          <button
            disabled={isPending}
            onClick={() => onLogMany(all.filter((m) => picked.includes(m.id)))}
            className="w-full bg-primary text-primary-foreground rounded-xl p-4 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Log {picked.length} meal{picked.length === 1 ? "" : "s"} for today
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  meals: Meal[];
  defaultType?: MealType;
}

export function QuickLogStrip({ meals }: Props) {
  const addMeal = useAddMeal();
  const addMeals = useAddMeals();
  const [selected, setSelected] = useState<FrequentMeal | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const frequentMeals = getFrequentMeals(meals);
  const today = todayISO();

  const confirmQuickLog = async (meal: FrequentMeal, type: MealType) => {
    try {
      await addMeal.mutateAsync({
        meal_name: meal.meal_name,
        type,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        date: today,
        micros: meal.micros,
      });
    } catch {
      return; // useAddMeal already toasted the error; keep the sheet open to retry
    }
    recordMealLogged();
    toast.success(`Logged ${meal.meal_name}`);
    setSelected(null);
  };

  const logMany = async (picked: FrequentMeal[]) => {
    try {
      await addMeals.mutateAsync(
        picked.map((meal) => ({
          meal_name: meal.meal_name,
          type: meal.type,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          date: today,
          micros: meal.micros,
        })),
      );
    } catch {
      return; // useAddMeals already toasted the error
    }
    recordMealLogged();
    toast.success(`Logged ${picked.length} meal${picked.length === 1 ? "" : "s"}`);
    setShowHistory(false);
  };

  if (frequentMeals.length === 0) return null;

  return (
    <>
      <section className="space-y-2">
        <div className="flex justify-between items-center mb-1 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Log</span>
          <button onClick={() => setShowHistory(true)} className="text-xs text-primary font-semibold">See all</button>
        </div>

        <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 scrollbar-none" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {frequentMeals.map((meal) => (
            <button
              key={meal.id}
              onClick={() => setSelected(meal)}
              className="flex-shrink-0 bg-card border border-border rounded-2xl p-3 w-36 text-left hover:border-primary/40 transition-colors"
            >
              <div className="text-lg mb-1">{getMealEmoji(meal.type)}</div>
              <div className="text-xs font-semibold text-foreground leading-tight mb-1 line-clamp-2">{meal.meal_name}</div>
              <div className="text-xs text-muted-foreground">{meal.calories} kcal  {meal.protein}g P</div>
              <div className="text-xs text-primary font-semibold mt-1">{meal.frequency}</div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <ConfirmSheet
          meal={selected}
          onClose={() => setSelected(null)}
          onConfirm={confirmQuickLog}
          isPending={addMeal.isPending}
        />
      )}

      {showHistory && (
        <FullHistory
          meals={meals}
          onSelect={(meal) => { setShowHistory(false); setSelected(meal); }}
          onLogMany={logMany}
          isPending={addMeals.isPending}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
