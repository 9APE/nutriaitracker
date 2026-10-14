import { useState, useEffect } from "react";
import { Search, Loader2, X, ChevronLeft } from "lucide-react";
import type { Meal, MealType } from "@/lib/nouri-storage";
import { useAddMeal } from "@/hooks/queries/useMeals";
import { recordMealLogged } from "@/lib/nouri-streak";
import { todayISO } from "@/lib/nouri-storage";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OFFProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  _id?: string;
  aiEstimated?: boolean;
}

interface MacroPreviewProps {
  label: string;
  value: number;
}
function MacroPreview({ label, value }: MacroPreviewProps) {
  return (
    <div className="text-center">
      <div className="font-semibold text-sm">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

interface PortionSheetProps {
  food: OFFProduct;
  onClose: () => void;
  onLog: (food: OFFProduct, portion: number, mealType: MealType) => void;
  isPending: boolean;
}

function PortionSheet({ food, onClose, onLog, isPending }: PortionSheetProps) {
  const [portion, setPortion] = useState(100);
  const [mealType, setMealType] = useState<MealType>("Lunch");

  const calcMacro = (nutrient: string) => {
    const per100g = food.nutriments?.[`${nutrient}_100g`] ?? food.nutriments?.[nutrient] ?? 0;
    return Math.round((per100g * portion) / 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-background rounded-t-3xl border-t border-border shadow-xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-4" />
        <h3 className="font-bold text-base mb-1">{food.product_name}</h3>
        {food.aiEstimated && (
          <span className="inline-block text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 mb-2">AI estimated</span>
        )}
        <div className="text-sm text-muted-foreground mb-4">How much did you have?</div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[50, 100, 150, 200, 250, 300].map((g) => (
            <button key={g} onClick={() => setPortion(g)}
              className={`p-2 rounded-xl border text-sm font-semibold transition-colors
                ${portion === g ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground"}`}>
              {g}g
            </button>
          ))}
        </div>

        <input type="number" placeholder="Or enter custom grams"
          className="w-full border border-border rounded-xl p-3 text-sm mb-4 bg-background"
          onChange={(e) => e.target.value && setPortion(+e.target.value)} />

        <div className="bg-muted rounded-xl p-3 mb-4 grid grid-cols-4 gap-2">
          <MacroPreview label="kcal" value={calcMacro("energy-kcal")} />
          <MacroPreview label="protein" value={calcMacro("proteins")} />
          <MacroPreview label="carbs" value={calcMacro("carbohydrates")} />
          <MacroPreview label="fat" value={calcMacro("fat")} />
        </div>

        <div className="flex gap-2 mb-4">
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as MealType[]).map((type) => (
            <button key={type} onClick={() => setMealType(type)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                ${mealType === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {type}
            </button>
          ))}
        </div>

        <button onClick={() => onLog(food, portion, mealType)} disabled={isPending}
          className="w-full bg-primary text-primary-foreground rounded-xl p-4 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {isPending && <Loader2 size={16} className="animate-spin" />}
          Log {portion}g of {food.product_name}
        </button>
      </div>
    </div>
  );
}

interface Props {
  meals: Meal[];
  onClose: () => void;
}

export function FoodDatabase({ meals, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OFFProduct | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const addMeal = useAddMeal();

  // Top 10 most frequently logged foods from history
  const frequentFoods = (() => {
    const freq: Record<string, { name: string; count: number }> = {};
    meals.forEach((m) => {
      const k = m.meal_name.toLowerCase();
      freq[k] = freq[k] ? { name: m.meal_name, count: freq[k].count + 1 } : { name: m.meal_name, count: 1 };
    });
    return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // Check custom foods first
        const custom: OFFProduct[] = JSON.parse(localStorage.getItem("customFoods") || "[]");
        const customMatches = custom.filter((f) =>
          f.product_name?.toLowerCase().includes(query.toLowerCase())
        );

        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20`
        );
        const data = await res.json();
        const off: OFFProduct[] = (data.products ?? []).filter((p: OFFProduct) => p.product_name);
        setResults([...customMatches, ...off]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const handleAiFallback = async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("Nutri AI-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Provide typical nutritional values per 100g for "${query}". Return ONLY valid JSON (no markdown): {"product_name":"...","brands":"AI Estimated","nutriments":{"energy-kcal_100g":0,"proteins_100g":0,"carbohydrates_100g":0,"fat_100g":0,"fiber_100g":0,"sugars_100g":0,"sodium_100g":0}}`
          }],
          mode: "nutrition-lookup"
        }
      });
      if (error) throw error;

      let parsed: OFFProduct | null = null;
      try {
        const text = typeof data === "string" ? data : data?.content ?? JSON.stringify(data);
        const match = text.match(/\{[\s\S]+\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {}

      if (parsed?.product_name) {
        const entry = { ...parsed, aiEstimated: true };
        const existing: OFFProduct[] = JSON.parse(localStorage.getItem("customFoods") || "[]");
        localStorage.setItem("customFoods", JSON.stringify([entry, ...existing]));
        setResults((prev) => [entry, ...prev]);
        toast.success(`Added "${parsed!.product_name}" (AI estimated)`);
      } else {
        toast.error("Couldn't find nutritional info");
      }
    } catch {
      toast.error("AI lookup failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLog = async (food: OFFProduct, portion: number, mealType: MealType) => {
    const n = food.nutriments ?? {};
    const calories = Math.round(((n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) * portion) / 100);
    const protein = Math.round(((n["proteins_100g"] ?? n.proteins ?? 0) * portion) / 100);
    const carbs = Math.round(((n["carbohydrates_100g"] ?? n.carbohydrates ?? 0) * portion) / 100);
    const fat = Math.round(((n["fat_100g"] ?? n.fat ?? 0) * portion) / 100);

    await addMeal.mutateAsync({
      meal_name: `${food.product_name}${food.brands ? ` (${food.brands})` : ""} ${portion}g`,
      type: mealType,
      calories,
      protein,
      carbs,
      fat,
      date: todayISO(),
    });
    recordMealLogged();
    toast.success(`Logged ${food.product_name}`);
    setSelected(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={onClose} className="p-1"><ChevronLeft size={20} /></button>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            placeholder='Search foods... e.g. rice, banana, chicken'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm bg-background"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My Foods section */}
        {!query && frequentFoods.length > 0 && (
          <div className="p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">My Foods</div>
            <div className="space-y-1">
              {frequentFoods.map((f) => (
                <button key={f.name} onClick={() => setQuery(f.name)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-border bg-card text-sm hover:border-primary/40 transition-colors">
                  {f.name} <span className="text-muted-foreground text-xs">×{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="divide-y divide-border">
            {results.map((food, i) => (
              <div key={food._id ?? i} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{food.product_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {food.brands && <span>{food.brands} · </span>}
                    <span>{Math.round(food.nutriments?.["energy-kcal_100g"] ?? 0)} kcal/100g</span>
                    {food.aiEstimated && (
                      <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 text-[10px]">AI estimated</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelected(food)}
                  className="text-primary font-bold text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
                  +
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI Fallback */}
        {query.trim() && !loading && (
          <div className="p-4 border-t border-border mt-2">
            <p className="text-sm text-muted-foreground mb-3">Don't see what you're looking for?</p>
            <button onClick={handleAiFallback} disabled={aiLoading}
              className="w-full border-2 border-dashed border-primary/40 rounded-xl p-3 text-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Ask Nutri AI to add "{query}"
            </button>
          </div>
        )}
      </div>

      {selected && (
        <PortionSheet
          food={selected}
          onClose={() => setSelected(null)}
          onLog={handleLog}
          isPending={addMeal.isPending}
        />
      )}
    </div>
  );
}


