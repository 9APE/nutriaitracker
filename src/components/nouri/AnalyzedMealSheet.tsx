import { Button } from "@/components/ui/button";
import { mealTypeEmoji } from "@/lib/nouri-storage";
import type { Meal } from "@/lib/nouri-storage";

interface AnalyzedMealSheetProps {
  meal: Omit<Meal, "id" | "created_at">;
  onRetry: () => void;
  onConfirm: () => void;
}

export function AnalyzedMealSheet({ meal, onRetry, onConfirm }: AnalyzedMealSheetProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onRetry} />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up p-6 pb-8">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

        <div className="flex items-start gap-3 mb-5">
          <div className="text-3xl">{mealTypeEmoji(meal.type)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-xl font-medium leading-tight">{meal.meal_name}</h3>
            <p className="text-sm text-muted-foreground">
              {meal.type} · {meal.date}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Chip label="Calories" value={`${meal.calories}`} unit="kcal" tone="calories" />
          <Chip label="Protein" value={`${meal.protein}`} unit="g" tone="protein" />
          <Chip label="Carbs" value={`${meal.carbs}`} unit="g" tone="carbs" />
          <Chip label="Fat" value={`${meal.fat}`} unit="g" tone="fat" />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={onRetry}>
            Try again
          </Button>
          <Button className="flex-1 h-12" onClick={onConfirm}>
            Log it ✓
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: "calories" | "protein" | "carbs" | "fat";
}) {
  const toneClass = {
    calories: "border-macro-calories/30 bg-primary-soft",
    protein: "border-macro-protein/30 bg-macro-protein/10",
    carbs: "border-macro-carbs/30 bg-macro-carbs/10",
    fat: "border-macro-fat/30 bg-macro-fat/10",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono-data text-lg text-foreground">
        {value}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
