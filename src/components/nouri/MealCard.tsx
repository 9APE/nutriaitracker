import { Trash2 } from "lucide-react";
import type { Meal } from "@/lib/nouri-storage";
import { mealTypeEmoji } from "@/lib/nouri-storage";

interface MealCardProps {
  meal: Meal;
  onDelete?: (id: string) => void;
}

export function MealCard({ meal, onDelete }: MealCardProps) {
  return (
    <div className="nouri-card p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{meal.meal_name}</div>
        <div className="text-xs text-muted-foreground">{meal.type}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono-data text-sm text-foreground">
          {Math.round(meal.calories)} <span className="text-muted-foreground text-xs">kcal</span>
        </div>
        <div className="font-mono-data text-xs text-muted-foreground">
          {Math.round(meal.protein)}g protein
        </div>
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(meal.id)}
          aria-label="Delete meal"
          className="p-2 -mr-1 rounded-full text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
