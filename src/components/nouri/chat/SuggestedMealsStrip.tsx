/**
 * SuggestedMealsStrip  horizontal carousel of AI-recommended meals shown
 * above the chat. Self-contained: fetches its own suggestions on mount and
 * exposes a refresh button.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, UtensilsCrossed, Cookie } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";
import type { Goals, Meal } from "@/lib/nouri-storage";
import type { MealSuggestion } from "./types";
import { useAuth } from "@/lib/auth-context";
import { getFamilyContext } from "@/lib/family-context";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";

interface Props {
  goals: Goals;
  todayMeals: Meal[];
  getProfile: () => Promise<Record<string, any> | null>;
  onAsk: (name: string) => void;
  onLog: (s: MealSuggestion) => void;
}

export function SuggestedMealsStrip({ goals, todayMeals, getProfile, onAsk, onLog }: Props) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const shownRef = useRef<string[]>([]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getProfile();
      const family = await getFamilyContext(profile, user?.id);
      const totals = todayMeals.reduce(
        (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const remaining = {
        calories: Math.max(0, (goals.calories || 0) - totals.calories),
        protein: Math.max(0, (goals.protein || 0) - totals.protein),
        carbs: Math.max(0, (goals.carbs || 0) - totals.carbs),
        fat: Math.max(0, (goals.fat || 0) - totals.fat),
      };
      const { data } = await supabase.functions.invoke("recommend-meals", {
        body: {
          remaining, totals, goals, profile,
          todayMealNames: todayMeals.map((m) => m.meal_name),
          training: "",
          recentlyRecommended: shownRef.current,
          currentHour: new Date().getHours(),
          familyMode: family.familyMode,
          familyRestrictions: family.mergedRestrictions,
          familyMembers: family.memberProfiles,
          nutritionistContext: buildNutritionistContext({
            meals: todayMeals,
            goals,
            userProfile: {
              ...(profile ?? {}),
              familyMembers: family.memberProfiles,
              familyRestrictions: family.mergedRestrictions,
            },
          }).aiContext,
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
        },
      });
      const list: MealSuggestion[] = data?.suggestions ?? [];
      setSuggestions(list);
      shownRef.current = [...shownRef.current, ...list.map((s) => s.meal_name)];
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [getProfile, goals, todayMeals, user?.id]);

  useEffect(() => { fetchSuggestions(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Next meal ideas</p>
        <button onClick={fetchSuggestions} disabled={loading}
          className="rounded-full p-1 text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-card hover:text-foreground disabled:opacity-40"
          aria-label="Refresh suggestions">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 w-44 flex-shrink-0 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {suggestions.map((s, i) => {
            const isSnack = s.meal_type?.toLowerCase() === "snack";
            return (
              <div key={i} className="flex w-44 flex-shrink-0 flex-col gap-2 rounded-[22px] border border-border/80 bg-card/95 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isSnack ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"
                  }`}>
                    {s.meal_type || "Meal"}
                  </span>
                  {isSnack ? <Cookie size={12} className="text-amber-500/60" /> : <UtensilsCrossed size={12} className="text-primary/40" />}
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-tight">{s.meal_name}</p>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>{s.calories} kcal</span>
                  <span>•</span>
                  <span>{s.protein}g P</span>
                </div>
                <div className="mt-auto flex gap-1.5">
                  <button onClick={() => onAsk(s.meal_name)}
                    className="flex-1 rounded-xl border border-border bg-background/70 py-1.5 text-[11px] text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground active:scale-[0.98]">
                    Ask
                  </button>
                  <button onClick={() => onLog(s)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 transition-all hover:-translate-y-0.5 hover:bg-primary/20 active:scale-[0.98]"
                    aria-label="Log this meal">
                    <Plus size={11} className="text-primary" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
