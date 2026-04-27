import { useEffect, useRef } from "react";
import type { Goals, Meal } from "@/lib/nouri-storage";
import {
  currentMealWindow,
  fetchSuggestions,
  fireBrowserNotification,
  notifStore,
  triggerStore,
} from "@/lib/nouri-suggestions";

interface Options {
  goals: Goals;
  meals: Meal[];
  onNew?: () => void;
}

// Polls every 60s. When inside a meal window and no suggestion has fired
// for that meal today yet, generate one and store it as a notification.
export function useAutoSuggestions({ goals, meals, onNew }: Options) {
  const runningRef = useRef(false);
  const goalsRef = useRef(goals);
  const mealsRef = useRef(meals);

  useEffect(() => {
    goalsRef.current = goals;
    mealsRef.current = meals;
  }, [goals, meals]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (runningRef.current) return;
      const mealType = currentMealWindow();
      if (!mealType) return;
      if (triggerStore.hasFiredToday(mealType)) return;

      runningRef.current = true;
      try {
        const suggestions = await fetchSuggestions(
          goalsRef.current,
          mealsRef.current,
          mealType
        );
        if (cancelled || suggestions.length === 0) return;

        triggerStore.markFired(mealType);
        notifStore.add({
          id: crypto.randomUUID(),
          created_at: Date.now(),
          mealType,
          suggestions,
          read: false,
        });
        fireBrowserNotification(
          `Nouri · ${mealType} ideas`,
          suggestions.map((s) => s.meal_name).join(" · ")
        );
        onNew?.();
      } catch (e) {
        console.error("auto-suggestion failed", e);
      } finally {
        runningRef.current = false;
      }
    };

    // Run shortly after mount, then every 60s
    const initial = setTimeout(tick, 2500);
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
