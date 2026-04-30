import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";

interface Suggestion {
  meal_name: string;
  why: string;
  protein: number;
  calories: number;
}

interface NouriRecommendsProps {
  goals: Goals;
  meals: Meal[];
  onPick: (mealName: string) => void;
}

// In-memory session cache (cleared on full page reload)
let sessionCache: Suggestion[] | null = null;

function readUserProfile(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("userProfile");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function NouriRecommends({ goals, meals, onPick }: NouriRecommendsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(sessionCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const remaining = {
    calories: Math.max(0, goals.calories - sum.calories),
    protein: Math.max(0, goals.protein - sum.protein),
    carbs: Math.max(0, goals.carbs - sum.carbs),
    fat: Math.max(0, goals.fat - sum.fat),
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getLanguage, getLanguageName } = await import("@/lib/nouri-i18n");
      const { data, error: err } = await supabase.functions.invoke("recommend-meals", {
        body: { remaining, profile: readUserProfile(), language: getLanguage() ?? "en", languageName: getLanguageName() },
      });
      if (err) throw new Error(err.message || "Failed to load suggestions");
      const list: Suggestion[] = data?.suggestions ?? [];
      sessionCache = list;
      setSuggestions(list);
    } catch (e: any) {
      setError(e?.message || "Couldn't get suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionCache === null) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    sessionCache = null;
    setSuggestions(null);
    load();
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-serif text-lg font-medium flex items-center gap-1.5">
          <span className="text-primary">🌿</span>
          Nouri Recommends
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Refresh suggestions"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        To hit {Math.round(remaining.protein)}g protein · {Math.round(remaining.calories)} kcal left
      </p>

      {loading && !suggestions && (
        <div className="nouri-card p-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Thinking up ideas…
        </div>
      )}

      {error && !loading && (
        <div className="nouri-card p-4 text-sm text-destructive">
          {error}{" "}
          <button onClick={load} className="underline ml-1">
            Try again
          </button>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onPick(s.meal_name)}
              className="w-full text-left nouri-card p-4 hover:border-primary/50 active:scale-[0.99] transition-all"
            >
              <div className="flex items-start gap-3">
                <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground leading-tight">
                    {s.meal_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {s.why}
                  </div>
                  <div className="flex gap-3 mt-2 font-mono-data text-[11px] text-muted-foreground">
                    <span>~{s.protein}g protein</span>
                    <span>·</span>
                    <span>~{s.calories} kcal</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
