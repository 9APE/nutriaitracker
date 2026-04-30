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

  const statItems: Array<{ label: string; value: string; emoji: string }> = [
    { label: "Meals logged", value: String(stats.totalMeals), emoji: "🍽️" },
    { label: "Protein days", value: `${stats.proteinDaysHit}/7`, emoji: "💪" },
    { label: "Avg calories", value: `${stats.avgCalories}`, emoji: "🔢" },
    { label: "Current streak", value: `${stats.streak}`, emoji: "🔥" },
    { label: "XP this week", value: `${stats.xpThisWeek}`, emoji: "⭐" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(20, 30, 24, 0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Weekly report"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 my-6 shadow-xl"
        style={{ backgroundColor: "#FBF8F1", border: "1px solid #E2D8C4" }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3"
            style={{ backgroundColor: "#EAF4EE", border: "2px solid #5BB882" }}
            aria-hidden
          >
            🌿
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Your week with Nouri
          </p>
          <h2 className="font-serif text-2xl font-medium mt-1" style={{ color: "#1F3A28" }}>
            Hey {name}, here's your week
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          {statItems.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 flex items-center gap-3"
              style={{ backgroundColor: "#F2EADB", border: "1px solid #E2D8C4" }}
            >
              <span className="text-xl shrink-0" aria-hidden>
                {s.emoji}
              </span>
              <div className="min-w-0">
                <div
                  className="font-mono-data text-lg leading-none"
                  style={{ color: "#1F3A28" }}
                >
                  {s.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 mt-5"
          style={{ backgroundColor: "#EAF4EE", border: "1px solid #5BB882" }}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#1F6B43" }}>
              <span className="inline-block w-2 h-2 rounded-full bg-[#5BB882] animate-pulse" />
              <span className="inline-block w-2 h-2 rounded-full bg-[#5BB882] animate-pulse [animation-delay:120ms]" />
              <span className="inline-block w-2 h-2 rounded-full bg-[#5BB882] animate-pulse [animation-delay:240ms]" />
              <span className="ml-1">Nouri is writing your summary…</span>
            </div>
          ) : (
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "#1F3A28" }}
            >
              {summary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleEnter}
          className="w-full mt-5 rounded-full py-3 text-white font-medium transition-transform active:scale-[0.99]"
          style={{ backgroundColor: "#5BB882" }}
        >
          Let's go this week! 🔥
        </button>
      </div>
    </div>
  );
}
