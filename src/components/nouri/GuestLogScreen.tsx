import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Meal, MealType } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";

interface Props {
  onAddMeal: (meal: Meal) => void | Promise<void>;
}

const TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

/**
 * Log tab for the temporary preview. AI meal analysis needs an account, so
 * guests add a meal by hand. Nothing is saved anywhere.
 */
export function GuestLogScreen({ onAddMeal }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MealType>("Lunch");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const num = (v: string) => Math.max(0, Number(v) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the meal a name");
      return;
    }
    await onAddMeal({
      id: crypto.randomUUID(),
      meal_name: name.trim(),
      type,
      calories: num(calories),
      protein: num(protein),
      carbs: num(carbs),
      fat: num(fat),
      date: todayISO(),
      created_at: Date.now(),
    });
    toast.success(`Added ${name.trim()} (preview only)`);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const field = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";

  return (
    <div className="px-5 pt-4 pb-36 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-medium">Log a meal</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a meal by hand to see how tracking works.</p>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-xs">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
        <span>
          With an account you can just say or type what you ate and Nutri AI works out the calories and nutrients.
          This preview doesn't include AI.
        </span>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="What did you eat?" aria-label="Meal name" />
        <div className="grid grid-cols-4 gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={field} inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories (kcal)" aria-label="Calories" />
          <input className={field} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" aria-label="Protein" />
          <input className={field} inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" aria-label="Carbs" />
          <input className={field} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" aria-label="Fat" />
        </div>
        <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
          Add meal
        </button>
      </form>
    </div>
  );
}
