import { X, Trash2, RefreshCw, Lightbulb, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meal } from "@/lib/nouri-storage";
import { mealTypeEmoji } from "@/lib/nouri-storage";
import { useAddFavorite, useFavorites } from "@/hooks/queries/useFavorites";

interface MicroDef {
  key: keyof NonNullable<Meal["micros"]>;
  label: string;
  unit: string;
}

const MICROS: MicroDef[] = [
  { key: "fiber",          label: "Fiber",         unit: "g" },
  { key: "sugar",          label: "Sugar",         unit: "g" },
  { key: "saturated_fat",  label: "Sat. Fat",      unit: "g" },
  { key: "sodium",         label: "Sodium",        unit: "mg" },
  { key: "potassium",      label: "Potassium",     unit: "mg" },
  { key: "cholesterol",    label: "Cholesterol",   unit: "mg" },
  { key: "calcium",        label: "Calcium",       unit: "mg" },
  { key: "iron",           label: "Iron",          unit: "mg" },
  { key: "vitamin_c",      label: "Vitamin C",     unit: "mg" },
  { key: "vitamin_a",      label: "Vitamin A",     unit: "g" },
  { key: "vitamin_d",      label: "Vitamin D",     unit: "g" },
];

interface Props {
  meal: Meal & { tip?: string; ingredients?: string[] };
  goals?: { calories: number; protein: number; carbs: number; fat: number };
  todaySoFar?: { calories: number; protein: number; carbs: number; fat: number };
  onClose: () => void;
  onDelete?: () => void;
  onReanalyze?: () => void;
}

/**
 * Full-screen meal details sheet. Shows macros (with progress vs today's
 * goals), every available micronutrient, the AI tip, and ingredients.
 */
export function MealDetailSheet({
  meal,
  goals,
  todaySoFar,
  onClose,
  onDelete,
  onReanalyze,
}: Props) {
  const hasMicros = meal.micros && Object.values(meal.micros).some((v) => v != null);
  const addFavorite = useAddFavorite();
  const favs = useFavorites();
  const isFavorite = (favs.data ?? []).some(
    (f) => f.meal_name === meal.meal_name && f.type === meal.type,
  );

  const handleSaveFavorite = () => {
    if (isFavorite) return;
    addFavorite.mutate({
      meal_name: meal.meal_name,
      type: meal.type,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      micros: meal.micros,
    });
  };

  const renderProgress = (consumed: number, goal: number) => {
    if (!goal) return null;
    const pct = Math.min(100, Math.round((consumed / goal) * 100));
    return (
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-slide-up">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Close">
          <X size={20} />
        </button>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Meal details</p>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-5 pt-5">
          <p className="text-xs text-muted-foreground">
            {mealTypeEmoji(meal.type)} {meal.type}  {meal.date}
          </p>
          <h1 className="font-serif text-2xl font-medium leading-tight mt-1">
            {meal.meal_name}
          </h1>
        </div>

        {/* Macros */}
        <section className="px-5 mt-6">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Macronutrients
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <MacroCard label="Calories" value={meal.calories} unit="kcal"
              consumed={(todaySoFar?.calories ?? 0)} goal={goals?.calories}
              renderProgress={renderProgress} />
            <MacroCard label="Protein" value={meal.protein} unit="g"
              consumed={(todaySoFar?.protein ?? 0)} goal={goals?.protein}
              renderProgress={renderProgress} />
            <MacroCard label="Carbs" value={meal.carbs} unit="g"
              consumed={(todaySoFar?.carbs ?? 0)} goal={goals?.carbs}
              renderProgress={renderProgress} />
            <MacroCard label="Fat" value={meal.fat} unit="g"
              consumed={(todaySoFar?.fat ?? 0)} goal={goals?.fat}
              renderProgress={renderProgress} />
          </div>
        </section>

        {/* Micros */}
        {hasMicros && (
          <section className="px-5 mt-6">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Micronutrients
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MICROS.map((m) => {
                const v = meal.micros?.[m.key];
                if (v == null) return null;
                return (
                  <div key={m.key} className="rounded-2xl border border-border bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </div>
                    <div className="font-mono-data text-base text-foreground">
                      {Math.round(Number(v) * 10) / 10}
                      <span className="text-[10px] text-muted-foreground ml-0.5">
                        {m.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tip */}
        {meal.tip && (
          <section className="mx-5 mt-6 rounded-2xl border border-border bg-primary/5 px-4 py-3 flex gap-2">
            <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{meal.tip}</p>
          </section>
        )}

        {/* Ingredients */}
        {meal.ingredients?.length ? (
          <section className="px-5 mt-6">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Ingredients
            </h2>
            <ul className="space-y-1">
              {meal.ingredients.map((ing, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground"></span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="border-t border-border bg-background px-4 py-3 flex gap-2">
        {onReanalyze && (
          <Button variant="outline" className="flex-1 h-11" onClick={onReanalyze}>
            <RefreshCw size={16} className="mr-2" />
            Re-analyze
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" className="flex-1 h-11 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1 h-11"
          onClick={handleSaveFavorite}
          disabled={isFavorite || addFavorite.isPending}
        >
          <Star
            size={16}
            className={`mr-2 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`}
          />
          {isFavorite ? "Favorited" : "Save as favorite"}
        </Button>
        <Button className="flex-1 h-11" onClick={onClose}>Done</Button>
      </footer>
    </div>
  );
}

function MacroCard({
  label, value, unit, consumed, goal, renderProgress,
}: {
  label: string;
  value: number;
  unit: string;
  consumed: number;
  goal?: number;
  renderProgress: (c: number, g: number) => React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono-data text-xl text-foreground">
        {value}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
      {goal ? (
        <>
          <div className="text-[10px] text-muted-foreground mt-1">
            {Math.round(consumed)} / {goal} {unit} today
          </div>
          {renderProgress(consumed, goal)}
        </>
      ) : null}
    </div>
  );
}
