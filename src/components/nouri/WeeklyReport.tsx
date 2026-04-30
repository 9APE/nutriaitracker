import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { getStreak } from "@/lib/nouri-streak";
import {
  computeWeeklyStats,
  markWeeklyReportShown,
  type WeeklyStats,
} from "@/lib/nouri-weekly-report";

interface WeeklyReportProps {
  name: string;
  meals: Meal[];
  goals: Goals;
  onClose: () => void;
}

export function WeeklyReport({ name, meals, goals, onClose }: WeeklyReportProps) {
  const [stats] = useState<WeeklyStats>(() =>
    computeWeeklyStats(meals, goals, getStreak().count)
  );
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getLanguage, getLanguageName } = await import("@/lib/nouri-i18n");
        const { data, error } = await supabase.functions.invoke("weekly-report", {
          body: {
            name,
            language: getLanguage() ?? "en",
            languageName: getLanguageName(),
            stats: {
              ...stats,
              proteinGoal: goals.protein,
              calorieGoal: goals.calories,
            },
          },
        });
        if (cancelled) return;
        if (error) throw error;
        setSummary(
          (data?.summary as string) ||
            `Great week, ${name}! You logged ${stats.totalMeals} meals and kept a ${stats.streak}-day streak. Keep it going next week.`
        );
      } catch (e) {
        if (!cancelled) {
          setSummary(
            `Nice work this week, ${name}! You logged ${stats.totalMeals} meals and held a ${stats.streak}-day streak. Let's keep the momentum next week.`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, goals.protein, goals.calories]);

  const handleEnter = () => {
    markWeeklyReportShown();
    onClose();
  };

  const statItems: Array<{ label: string; value: string }> = [
    { label: "Meals logged", value: String(stats.totalMeals) },
    { label: "Protein days", value: `${stats.proteinDaysHit}/7` },
    { label: "Avg calories", value: `${stats.avgCalories}` },
    { label: "Current streak", value: `${stats.streak}` },
    { label: "XP this week", value: `${stats.xpThisWeek}` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-foreground/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Weekly report"
    >
      <div className="w-full max-w-md rounded-3xl p-6 my-6 shadow-xl border border-border bg-card text-card-foreground">
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 border-2"
            style={{
              backgroundColor: "hsl(var(--tone-success-bg))",
              borderColor: "hsl(var(--tone-success-border))",
            }}
            aria-hidden
          >
            🌿
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Your week with Nouri
          </p>
          <h2 className="font-serif text-2xl font-medium mt-1 text-foreground">
            Hey {name}, here's your week
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          {statItems.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 border border-border bg-muted/40"
            >
              <div className="min-w-0">
                <div className="font-mono-data text-lg leading-none text-foreground">
                  {s.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 mt-5 border"
          style={{
            backgroundColor: "hsl(var(--tone-success-bg))",
            borderColor: "hsl(var(--tone-success-border))",
            color: "hsl(var(--tone-success-fg))",
          }}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:120ms]" />
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:240ms]" />
              <span className="ml-1">Nouri is writing your summary…</span>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleEnter}
          className="w-full mt-5 rounded-full py-3 bg-primary text-primary-foreground font-medium transition-transform active:scale-[0.99]"
        >
          Let's go this week.
        </button>
      </div>
    </div>
  );
}
