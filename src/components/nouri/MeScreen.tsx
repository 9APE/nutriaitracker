import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarRange, ChevronRight, Flame, MessageSquare, Sparkles, Target, TrendingUp } from "lucide-react";
import { getLevelInfo, getTotalXP, getXPEarnedToday } from "@/lib/nouri-xp";
import { getStreak } from "@/lib/nouri-streak";
import { InsightChartList } from "@/components/nouri/InsightsScreen";
import { MealHistoryList } from "@/components/nouri/HistoryScreen";
import { isoDateLocal, type Goals, type Meal } from "@/lib/nouri-storage";
import { buildNutriAICoach } from "@/lib/nutri-ai-coach";
import { getCoachState, onCoachStateChange } from "@/lib/nutri-ai-coach-state";
import {
  getMeSectionMode,
  setMeSectionMode,
  subscribeMeSectionMode,
  type MeSectionMode,
} from "@/lib/me-section-mode";

interface MeScreenProps {
  meals: Meal[];
  goals: Goals;
  userId?: string | null;
  onDelete: (id: string) => void;
  onOpenXP: () => void;
  onOpenSettings: () => void;
  onStartCheckin?: () => void;
  onOpenFeedback?: () => void;
}

function XPStreakCard({ userId, onOpenXP }: { userId?: string | null; onOpenXP: () => void }) {
  const [xp, setXp] = useState(() => getTotalXP(userId));
  const [xpToday, setXpToday] = useState(() => getXPEarnedToday(userId));
  const [streak, setStreak] = useState(() => getStreak(userId));
  const info = getLevelInfo(xp);

  useEffect(() => {
    const refresh = () => {
      setXp(getTotalXP(userId));
      setXpToday(getXPEarnedToday(userId));
      setStreak(getStreak(userId));
    };
    window.addEventListener("xp:awarded", refresh);
    window.addEventListener("streak:updated", refresh);
    return () => {
      window.removeEventListener("xp:awarded", refresh);
      window.removeEventListener("streak:updated", refresh);
    };
  }, [userId]);

  return (
    <button
      onClick={onOpenXP}
      className="w-full overflow-hidden rounded-[28px] border border-border text-left"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--tone-gold-bg)) 0%, hsl(var(--card)) 52%, hsl(var(--primary) / 0.10) 100%)",
      }}
      aria-label="Open XP and streak details"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Progress</div>
            <div className="font-serif text-3xl leading-none text-foreground">Level {info.level}</div>
            <div className="text-sm text-muted-foreground">{xp.toLocaleString()} XP total</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1.5">
            <Flame size={14} className="text-orange-500" />
            <span className="font-mono-data text-sm tabular-nums text-foreground">{streak.count}</span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{info.xpIntoLevel} / {info.xpForLevel} XP</span>
            <span>{info.xpToNext} to Level {info.level + 1}</span>
          </div>
          <div className="h-2 rounded-full bg-background/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${info.pct}%`,
                background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--tone-gold-border)) 100%)",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">XP</div>
            <div className="mt-1 font-mono-data text-lg text-foreground tabular-nums">+{xpToday}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Streak</div>
            <div className="mt-1 font-mono-data text-lg text-foreground tabular-nums">{streak.count}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next</div>
            <div className="mt-1 font-mono-data text-lg text-foreground tabular-nums">{info.xpToNext}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-primary">
          <span>View XP details</span>
          <ChevronRight size={12} />
        </div>
      </div>
    </button>
  );
}

function OverviewRow({ meals, goals }: { meals: Meal[]; goals: Goals }) {
  const last7Meals = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffIso = isoDateLocal(cutoff);
    return meals.filter((meal) => meal.date >= cutoffIso);
  }, [meals]);

  const proteinDaysHit = useMemo(() => {
    const daily = new Map<string, number>();
    for (const meal of last7Meals) {
      daily.set(meal.date, (daily.get(meal.date) ?? 0) + meal.protein);
    }
    return [...daily.values()].filter((protein) => protein >= goals.protein).length;
  }, [goals.protein, last7Meals]);

  const avgCalories = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const meal of last7Meals) {
      byDay.set(meal.date, (byDay.get(meal.date) ?? 0) + meal.calories);
    }
    const values = [...byDay.values()];
    return values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
  }, [last7Meals]);

  const cards = [
    { label: "7-day avg", value: `${avgCalories}`, note: "calories", Icon: TrendingUp },
    { label: "Protein goal", value: `${proteinDaysHit}/7`, note: "days hit", Icon: Target },
    { label: "Meals logged", value: `${last7Meals.length}`, note: "last 7 days", Icon: CalendarRange },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map(({ label, value, note, Icon }) => (
        <div key={label} className="rounded-2xl border border-border bg-card px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <Icon size={13} className="text-primary" />
          </div>
          <div className="mt-2 font-mono-data text-xl leading-none text-foreground">{value}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function NutritionistFocusCard({
  meals,
  goals,
  userId,
  onStartCheckin,
  onOpenFeedback,
}: {
  meals: Meal[];
  goals: Goals;
  userId?: string | null;
  onStartCheckin?: () => void;
  onOpenFeedback?: () => void;
}) {
  const [coachState, setCoachState] = useState(() => getCoachState(userId));

  useEffect(() => {
    const refresh = () => setCoachState(getCoachState(userId));
    refresh();
    return onCoachStateChange(refresh);
  }, [userId]);

  const coach = useMemo(
    () =>
      buildNutriAICoach({
        meals,
        goals,
        coachState,
      }),
    [coachState, goals, meals],
  );

  const toneLabel = coach.coachTone.charAt(0).toUpperCase() + coach.coachTone.slice(1);

  return (
    <section className="rounded-[24px] border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Your nutritionist</div>
          <h2 className="font-serif text-2xl leading-tight text-foreground">{coach.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{coach.message}</p>
        </div>
        <div className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground">
          {toneLabel}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current window</div>
          <div className="mt-1 text-sm font-medium text-foreground">{coach.window}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next best action</div>
          <div className="mt-1 text-sm font-medium text-foreground">{coach.nextBestAction}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles size={14} className="text-primary" />
          What your nutritionist is watching
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          {coach.why.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStartCheckin}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start weekly check-in
          <ArrowUpRight size={14} />
        </button>
        <button
          type="button"
          onClick={onOpenFeedback}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
        >
          <MessageSquare size={14} className="text-primary" />
          Share feedback
        </button>
      </div>
    </section>
  );
}

function DailySignalsPanel({
  meals,
  goals,
  userId,
  onStartCheckin,
  onOpenFeedback,
}: {
  meals: Meal[];
  goals: Goals;
  userId?: string | null;
  onStartCheckin?: () => void;
  onOpenFeedback?: () => void;
}) {
  const today = isoDateLocal(new Date());
  const todayMeals = meals.filter((meal) => meal.date === today);
  const todayCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const todayProtein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const caloriesPct = goals.calories > 0 ? Math.min(100, Math.round((todayCalories / goals.calories) * 100)) : 0;
  const proteinPct = goals.protein > 0 ? Math.min(100, Math.round((todayProtein / goals.protein) * 100)) : 0;

  const summaryCards = [
    {
      label: "Calories today",
      value: `${todayCalories}`,
      note: `${Math.max(goals.calories - todayCalories, 0)} left`,
      progress: caloriesPct,
    },
    {
      label: "Protein today",
      value: `${todayProtein}g`,
      note: `${Math.max(goals.protein - todayProtein, 0)}g to goal`,
      progress: proteinPct,
    },
    {
      label: "Meals logged",
      value: `${todayMeals.length}`,
      note: todayMeals.length === 0 ? "Start with one meal" : "Logged today",
      progress: Math.min(100, todayMeals.length * 25),
    },
  ];

  return (
    <section className="space-y-3">
      <NutritionistFocusCard
        meals={meals}
        goals={goals}
        userId={userId}
        onStartCheckin={onStartCheckin}
        onOpenFeedback={onOpenFeedback}
      />

      <div className="rounded-[24px] border border-border bg-card p-4 space-y-4">
        <div>
          <div className="text-sm font-medium text-foreground">Today’s signals</div>
          <p className="mt-1 text-xs text-muted-foreground">
            A simpler read on what you have logged today and where your nutritionist wants attention next.
          </p>
        </div>

        <div className="space-y-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</div>
                  <div className="mt-1 font-mono-data text-lg text-foreground">{card.value}</div>
                </div>
                <div className="text-[11px] text-muted-foreground text-right">{card.note}</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MeScreen({
  meals,
  goals,
  userId,
  onDelete,
  onOpenXP,
  onOpenSettings,
  onStartCheckin,
  onOpenFeedback,
}: MeScreenProps) {
  const [sectionMode, setSectionModeState] = useState<MeSectionMode>(() => getMeSectionMode(userId));

  useEffect(() => {
    setSectionModeState(getMeSectionMode(userId));
    return subscribeMeSectionMode((mode, changedUserId) => {
      if ((changedUserId ?? null) !== (userId ?? null)) return;
      setSectionModeState(mode);
    });
  }, [userId]);

  const updateSectionMode = (mode: MeSectionMode) => {
    setSectionModeState(mode);
    setMeSectionMode(mode, userId);
  };

  return (
    <div className="px-5 pt-4 pb-36 max-w-md mx-auto space-y-5">
      <XPStreakCard userId={userId} onOpenXP={onOpenXP} />

      <OverviewRow meals={meals} goals={goals} />

      <section className="space-y-3">
        <SectionHeader
          title={sectionMode === "signals" ? "Daily signals" : "Insights"}
          subtitle={
            sectionMode === "signals"
              ? "Check-ins first, then the numbers that matter most today"
              : "A sharper look at the last 7 days against your daily targets"
          }
        />
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/30 p-1">
          {([
            ["signals", "Daily Signals"],
            ["insights", "Insights"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`rounded-[14px] px-3 py-2 text-sm font-medium transition-colors ${
                sectionMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={sectionMode === mode}
              onClick={() => updateSectionMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {sectionMode === "signals" ? (
          <DailySignalsPanel
            meals={meals}
            goals={goals}
            userId={userId}
            onStartCheckin={onStartCheckin}
            onOpenFeedback={onOpenFeedback}
          />
        ) : (
          <div className="rounded-[24px] border border-border bg-card p-4">
            <InsightChartList meals={meals} goals={goals} compact />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="History"
          subtitle="Your latest logged meals, grouped by day"
        />
        <MealHistoryList meals={meals} onDelete={onDelete} />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm font-medium">Settings</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button
          onClick={onOpenFeedback}
          className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 hover:bg-muted/40 transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <MessageSquare size={14} className="text-primary" />
            Feedback
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
