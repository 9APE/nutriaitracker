import { useEffect, useMemo, useState } from "react";

import { MealCard } from "@/components/nouri/MealCard";
import { NouriRecommends } from "@/components/nouri/NouriRecommends";
import { RemainingBanner } from "@/components/nouri/RemainingBanner";
import { MetricRing } from "@/components/nouri/MetricRing";
import { AdjustDashboardSheet } from "@/components/nouri/AdjustDashboardSheet";
import {
  DEFAULT_LAYOUT,
  METRIC_META,
  getStoredLayout,
  goalForMetric,
  isTracked,
  onLayoutChange,
  totalForMetric,
  type DashboardLayout,
} from "@/lib/nouri-dashboard-layout";
import { ChevronDown, ChevronUp, Sliders, Sparkles } from "lucide-react";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { getStreak, getFreezes } from "@/lib/nouri-streak";
import { getTotalXP, getLevelInfo } from "@/lib/nouri-xp";
import { isCheckinDue } from "@/components/nouri/WeeklyCheckin";
import { EveningNudge } from "@/components/nouri/EveningNudge";
import { TrainingSheet } from "@/components/nouri/TrainingSheet";
import {
  getTodayTraining,
  saveTodayTraining,
  trainingEmoji,
  TRAINING_PROTEIN_BONUS,
  type TrainingEntry,
} from "@/lib/nouri-training";
import { Mic, Dumbbell } from "lucide-react";
import { useLanguage, t, getLocale } from "@/lib/nouri-i18n";

interface TodayScreenProps {
  goals: Goals;
  meals: Meal[];
  userProfile?: any;
  onDeleteMeal: (id: string) => void;
  onGoLog: () => void;
  onPickSuggestion?: (mealName: string) => void;
  onOpenXP?: () => void;
  onStartCheckin?: () => void;
}

export function TodayScreen({
  goals,
  meals,
  userProfile,
  onDeleteMeal,
  onGoLog,
  onPickSuggestion,
  onOpenXP,
  onStartCheckin,
}: TodayScreenProps) {
  const lang = useLanguage();
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

  const remaining = Math.max(0, goals.calories - sum.calories);
  const calPct = Math.min(100, (sum.calories / goals.calories) * 100);

  const dateLabel = new Date().toLocaleDateString(getLocale(lang), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [streak, setStreak] = useState(() => getStreak());
  const [freezes, setFreezesState] = useState(() => getFreezes());
  const [xp, setXp] = useState(() => getTotalXP());
  useEffect(() => {
    const refresh = () => {
      setStreak(getStreak());
      setFreezesState(getFreezes());
      setXp(getTotalXP());
    };
    refresh();
    window.addEventListener("streak:updated", refresh);
    window.addEventListener("xp:awarded", refresh);
    return () => {
      window.removeEventListener("streak:updated", refresh);
      window.removeEventListener("xp:awarded", refresh);
    };
  }, [meals]);
  const levelInfo = getLevelInfo(xp);

  const [training, setTraining] = useState<TrainingEntry | null>(() => getTodayTraining());
  const [trainingSheetOpen, setTrainingSheetOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setTraining(getTodayTraining());
    refresh();
    window.addEventListener("training:updated", refresh);
    return () => window.removeEventListener("training:updated", refresh);
  }, []);

  // Personalized dashboard layout (AI-decided)
  const [layout, setLayout] = useState<DashboardLayout>(() => getStoredLayout() ?? DEFAULT_LAYOUT);
  const [showSmall, setShowSmall] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const stored = getStoredLayout();
      if (stored) setLayout(stored);
    };
    refresh();
    return onLayoutChange(refresh);
  }, []);

  const metricVal = useMemo(
    () => (m: any) => totalForMetric(m, meals),
    [meals]
  );

  // Apply training bonus to displayed protein goal only (not persisted)
  const displayedGoals: Goals = training
    ? { ...goals, protein: goals.protein + TRAINING_PROTEIN_BONUS }
    : goals;

  const streakActive =
    streak.count > 0 &&
    (streak.lastLogDate === today ||
      streak.lastLogDate ===
        (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return d.toISOString().slice(0, 10);
        })());

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("today", lang)}</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-medium">{dateLabel}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenXP}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-transform active:scale-95 hover:brightness-105"
              style={{ backgroundColor: "#FFF8E1", borderColor: "#F0C24A", color: "#7A5800" }}
              title={`Level ${levelInfo.level} • ${xp} XP`}
              aria-label="View your XP and level"
            >
              Lvl {levelInfo.level} ⭐
            </button>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
              style={{ backgroundColor: "#EAF4EE", borderColor: "#5BB882", color: "#1F6B43" }}
              title="Daily logging streak"
            >
              {streakActive ? `🔥 ${streak.count}` : "Start streak"}
            </span>
            {freezes > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
                style={{ backgroundColor: "#E8F1FB", borderColor: "#5B8FCC", color: "#1F4A82" }}
                title="Streak freezes available"
              >
                {freezes} freeze
              </span>
            )}
          </div>
        </div>
      </div>

      <EveningNudge meals={meals} onGoLog={onGoLog} />

      {training ? (
        <div
          className="rounded-2xl border p-3 flex items-center gap-3"
          style={{ backgroundColor: "#EAF4EE", borderColor: "#5BB882" }}
          role="status"
        >
          <p className="text-xs flex-1" style={{ color: "#1F6B43" }}>
            {t("trainingLogged", lang, { n: TRAINING_PROTEIN_BONUS })}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setTrainingSheetOpen(true)}
          className="w-full rounded-2xl border p-3 flex items-center gap-3 transition-transform active:scale-[0.99]"
          style={{ backgroundColor: "#F2EADB", borderColor: "#E2D8C4" }}
        >
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FBF8F1" }}
            aria-hidden
          >
            <Dumbbell size={18} style={{ color: "#5A4422" }} />
          </span>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium" style={{ color: "#1F3A28" }}>
              {t("logTraining", lang)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("trainingBumps", lang, { n: TRAINING_PROTEIN_BONUS })}
            </div>
          </div>
        </button>
      )}

      {isCheckinDue(localStorage.getItem("nouri:signupDate")) && onStartCheckin && (
        <button
          type="button"
          onClick={onStartCheckin}
          className="w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-transform active:scale-[0.99]"
          style={{ backgroundColor: "#EAF4EE", borderColor: "#5BB882" }}
        >
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: "#1F6B43" }}>
              {t("weeklyCheckinTitle", lang)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#1F6B43", opacity: 0.8 }}>
              {t("weeklyCheckinSub", lang)}
            </div>
          </div>
          <span
            className="text-xs font-medium px-3 py-1.5 rounded-full text-white shrink-0"
            style={{ backgroundColor: "#5BB882" }}
          >
            {t("letsGo", lang)}
          </span>
        </button>
      )}

      {/* AI-personalized banner */}
      {layout.banner && (
        <div
          className="rounded-2xl border p-3 flex items-start gap-2"
          style={{ backgroundColor: "#FFF8E1", borderColor: "#F0C24A", color: "#7A5800" }}
        >
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{layout.banner}</p>
        </div>
      )}

      {/* Large priority metrics */}
      {layout.large.length > 0 && (
        <section
          className={
            layout.large.length === 1
              ? "grid grid-cols-1 gap-3"
              : layout.large.length === 2
              ? "grid grid-cols-2 gap-3"
              : "grid grid-cols-3 gap-3"
          }
        >
          {layout.large.map((m) => (
            <MetricRing
              key={m}
              metric={m}
              size="large"
              current={metricVal(m)}
              goal={goalForMetric(m, m === "protein" ? displayedGoals : goals)}
            />
          ))}
        </section>
      )}

      {/* Medium metrics */}
      {layout.medium.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          {layout.medium.map((m) => (
            <MetricRing
              key={m}
              metric={m}
              size="medium"
              current={metricVal(m)}
              goal={goalForMetric(m, m === "protein" ? displayedGoals : goals)}
            />
          ))}
        </section>
      )}

      {/* Small metrics, collapsed */}
      {layout.small.length > 0 && (
        <section className="nouri-card p-4">
          <button
            type="button"
            onClick={() => setShowSmall((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-foreground"
          >
            <span>More nutrients</span>
            {showSmall ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showSmall && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {layout.small.map((m) => {
                const meta = METRIC_META[m];
                const tracked = isTracked(m);
                const cur = metricVal(m);
                const goal = goalForMetric(m, m === "protein" ? displayedGoals : goals);
                return (
                  <div key={m} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{meta.label}</span>
                    <span className="font-mono-data text-foreground">
                      {tracked ? `${Math.round(cur)}/${Math.round(goal)} ${meta.unit}` : `— ${meta.unit}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <RemainingBanner
        remainingProtein={displayedGoals.protein - sum.protein}
        remainingCalories={goals.calories - sum.calories}
      />

      <button
        type="button"
        onClick={() => setAdjustOpen(true)}
        className="w-full rounded-2xl border border-border bg-surface hover:bg-muted transition-colors py-3 px-4 flex items-center justify-center gap-2 text-sm text-foreground"
      >
        <Sliders size={14} />
        Adjust my dashboard
      </button>

      <button
        onClick={onGoLog}
        className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors py-5 px-4 flex items-center justify-center gap-2 text-primary font-medium"
      >
        <Mic size={18} />
        {t("logMealCta", lang)}
      </button>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-medium px-1">{t("todaysMeals", lang)}</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-4">
            {t("nothingLoggedYet", lang)}
          </p>
        ) : (
          <div className="space-y-2">
            {todayMeals.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={onDeleteMeal} />
            ))}
          </div>
        )}
      </section>

      <NouriRecommends
        goals={goals}
        meals={meals}
        onPick={(name) => onPickSuggestion?.(name)}
      />

      <TrainingSheet
        open={trainingSheetOpen}
        onClose={() => setTrainingSheetOpen(false)}
        onPick={(type) => {
          saveTodayTraining(type);
          setTrainingSheetOpen(false);
        }}
      />

      <AdjustDashboardSheet
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        profile={userProfile}
        goals={goals}
        currentLayout={layout}
        onUpdated={(l) => setLayout(l)}
      />
    </div>
  );
}
