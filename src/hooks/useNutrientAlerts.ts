import { useEffect, useMemo, useCallback, useState } from "react";
import type { Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import type { ExtendedGoals } from "@/lib/nouri-goals";
import type { UserProfile } from "@/components/nouri/ProfileChatOnboarding";
import {
  computeNutrientAlerts,
  computeDayTotals,
  type NutrientAlert,
  type DayTotals,
} from "@/lib/nouri-nutrient-alerts";
import { dayScopedUserKey } from "@/lib/user-scoped-storage";

interface DismissEntry {
  consumedAtDismiss: number;
}

function storageKey(userId?: string | null, date = todayISO()) {
  return dayScopedUserKey("nouri:alerts-dismissed", date, userId);
}

function loadDismissed(userId?: string | null, date = todayISO()): Map<string, DismissEntry> {
  try {
    const raw = localStorage.getItem(storageKey(userId, date));
    if (!raw) return new Map();
    return new Map(Object.entries<DismissEntry>(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveDismissed(map: Map<string, DismissEntry>, userId?: string | null, date = todayISO()) {
  try {
    localStorage.setItem(storageKey(userId, date), JSON.stringify(Object.fromEntries(map)));
  } catch {}
}

export function useNutrientAlerts(
  meals: Meal[],
  goals: ExtendedGoals | undefined,
  userProfile: UserProfile | null,
  userId?: string | null,
  date = todayISO(),
): { alerts: NutrientAlert[]; dismiss: (id: string, consumed: number) => void; dayTotals: DayTotals } {
  const [dismissed, setDismissed] = useState<Map<string, DismissEntry>>(() => loadDismissed(userId, date));

  useEffect(() => {
    setDismissed(loadDismissed(userId, date));
  }, [userId, date]);

  const dayTotals = useMemo(() => computeDayTotals(meals, date), [meals, date]);

  const allAlerts = useMemo(
    () => (goals ? computeNutrientAlerts(dayTotals, goals, userProfile) : []),
    [dayTotals, goals, userProfile],
  );

  // Re-show a dismissed alert if the consumed value grew by >10% since dismissal.
  const alerts = useMemo(
    () =>
      allAlerts.filter((a) => {
        const entry = dismissed.get(a.id);
        if (!entry) return true;
        return a.consumed > entry.consumedAtDismiss * 1.1;
      }),
    [allAlerts, dismissed],
  );

  const dismiss = useCallback((id: string, consumed: number) => {
    setDismissed((prev) => {
      const next = new Map(prev);
      next.set(id, { consumedAtDismiss: consumed });
      saveDismissed(next, userId, date);
      return next;
    });
  }, [userId, date]);

  return { alerts, dismiss, dayTotals };
}
