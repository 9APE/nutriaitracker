import { useEffect, useState, useRef } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { Badge } from "@/components/ui/badge";

interface Suggestion {
  meal_name: string;
  meal_type?: string;
  why: string;
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
  restriction_badges?: string[];
  suitable_for?: string; // legacy fallback
}

interface NouriRecommendsProps {
  goals: Goals;
  meals: Meal[];
  onPick: (mealName: string) => void;
}

interface HistoryEntry {
  date: string;
  meals: string[];
}

const HISTORY_KEY = "recommendationHistory";

function readFresh(key: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getRecommendationHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw);
    // Keep only last 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return entries.filter((e) => e.date >= cutoffISO);
  } catch {
    return [];
  }
}

function saveRecommendationHistory(mealNames: string[]) {
  const today = todayISO();
  let history = getRecommendationHistory();
  // Remove today's existing entry if any, replace with new
  history = history.filter((e) => e.date !== today);
  history.push({ date: today, meals: mealNames });
  // Keep only last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  history = history.filter((e) => e.date >= cutoffISO);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function NouriRecommends({ goals, meals, onPick }: NouriRecommendsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justShownRef = useRef<string[]>([]);

  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);

  const buildTotals = () =>
    todayMeals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fat: a.fat + m.fat,
        fiber: a.fiber + (m.micros?.fiber || 0),
        sugar: a.sugar + (m.micros?.sugar || 0),
        sodium: a.sodium + (m.micros?.sodium || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

  const load = async (extraAvoid: string[] = []) => {
    setLoading(true);
    setError(null);
    try {
      const profile = readFresh("userProfile");
      const userGoals: any = readFresh("nouri:goals") ?? goals;
      const totals = buildTotals();
      const remaining = {
        calories: Math.max(0, (userGoals.calories || 0) - totals.calories),
        protein: Math.max(0, (userGoals.protein || 0) - totals.protein),
        carbs: Math.max(0, (userGoals.carbs || 0) - totals.carbs),
        fat: Math.max(0, (userGoals.fat || 0) - totals.fat),
        fiber: Math.max(0, (userGoals.fiber || 0) - totals.fiber),
      };
      const todayMealNames = todayMeals.map((m) => m.meal_name);

      // Training
      let training = "";
      try {
        const raw = localStorage.getItem("todayTraining");
        if (raw) {
          const t = JSON.parse(raw);
          if (t?.date === today) training = t.type || "workout";
        }
      } catch {}

      // Recommendation history
      const history = getRecommendationHistory();
      const recentMealNames = history.flatMap((h) => h.meals);
      // Also include extraAvoid (just-shown meals on refresh)
      const allAvoid = [...new Set([...recentMealNames, ...extraAvoid])];

      const { getLanguage, getLanguageName } = await import("@/lib/nouri-i18n");
      const { data, error: err } = await supabase.functions.invoke("recommend-meals", {
        body: {
          remaining,
          totals,
          goals: userGoals,
          profile,
          todayMealNames,
          training,
          recentlyRecommended: allAvoid,
          currentHour: new Date().getHours(),
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
        },
      });
      if (err) throw new Error(err.message || "Failed to load suggestions");
      const list: Suggestion[] = data?.suggestions ?? [];
      setSuggestions(list);
      // Save to history
      const names = list.map((s) => s.meal_name);
      justShownRef.current = names;
      saveRecommendationHistory(names);
    } catch (e: any) {
      setError(e?.message || "Couldn't get suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    setSuggestions(null);
    load(justShownRef.current);
  };

  const totals = buildTotals();
  const remaining = {
    calories: Math.max(0, goals.calories - totals.calories),
    protein: Math.max(0, goals.protein - totals.protein),
  };

  const getBadges = (s: Suggestion): string[] => {
    if (s.restriction_badges && s.restriction_badges.length > 0) return s.restriction_badges;
    if (s.suitable_for) return [s.suitable_for];
    return [];
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-serif text-lg font-medium flex items-center gap-1.5">
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
          <button onClick={() => load()} className="underline ml-1">
            Try again
          </button>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => {
            const badges = getBadges(s);
            return (
              <button
                key={i}
                onClick={() => onPick(s.meal_name)}
                className="w-full text-left nouri-card p-4 hover:border-primary/50 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start gap-3">
                  <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground leading-tight">
                        {s.meal_name}
                      </span>
                      {s.meal_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                          {s.meal_type}
                        </Badge>
                      )}
                    </div>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {badges.map((b, j) => (
                          <Badge
                            key={j}
                            className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 font-medium"
                          >
                            {b}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {s.why}
                    </div>
                    <div className="flex gap-3 mt-2 font-mono-data text-[11px] text-muted-foreground">
                      <span>~{s.protein}g P</span>
                      <span>~{s.carbs}g C</span>
                      <span>~{s.fat}g F</span>
                      <span>·</span>
                      <span>~{s.calories} kcal</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
