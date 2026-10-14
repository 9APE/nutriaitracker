import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ConditionAlertCards } from "@/components/nouri/ConditionAlertCards";
import { TodayFocus } from "@/components/nouri/TodayFocus";
import { CoachCard } from "@/components/nouri/CoachCard";
import { CoachPromptDialog } from "@/components/nouri/CoachPromptDialog";

import { MealCard } from "@/components/nouri/MealCard";
import { AdjustDashboardSheet } from "@/components/nouri/AdjustDashboardSheet";
import { WidgetDashboard } from "@/components/nouri/WidgetDashboard";
import {
  DEFAULT_LAYOUT,
  getStoredLayout,
  onLayoutChange,
  METRIC_META,
  LIMIT_METRICS,
  totalForMetric,
  type DashboardLayout,
  type Metric,
} from "@/lib/nouri-dashboard-layout";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Flame, Mic, Dumbbell } from "lucide-react";
import type { Goals, Meal, MealType, WaterQuickAmount } from "@/lib/nouri-storage";
import { addWaterIntakeForDate, getWaterIntakeForDate, isoDateLocal, todayISO, WATER_AMOUNTS_ML } from "@/lib/nouri-storage";
import { getStreak, getFreezes } from "@/lib/nouri-streak";
import { getTotalXP, getLevelInfo } from "@/lib/nouri-xp";
import { isCheckinDue } from "@/components/nouri/WeeklyCheckin";
import { EveningNudge } from "@/components/nouri/EveningNudge";
import { QuickLogStrip } from "@/components/nouri/QuickLogStrip";
import { TrainingSheet } from "@/components/nouri/TrainingSheet";
import {
  getTodayTraining,
  saveTodayTraining,
  TRAINING_PROTEIN_BONUS,
  type TrainingEntry,
} from "@/lib/nouri-training";
import { checkTrainingAward } from "@/lib/nouri-xp";
import { useLanguage, t, getLocale } from "@/lib/nouri-i18n";
import {
  computeTodayGoals,
  type ExtendedGoals,
} from "@/lib/nouri-goals";
import { useGoals } from "@/hooks/queries/useGoals";
import { goalForMetric } from "@/lib/nouri-dashboard-layout";
import type { WidgetItem } from "@/lib/nouri-widget-layout";
import { useNutrientAlerts } from "@/hooks/useNutrientAlerts";
import {
  evaluateConditionRules,
  summarizeMetricStatuses,
  type MetricStatusSummary,
  type RuleStatus,
} from "@/lib/nutri-ai-condition-evaluator";
import { buildNutriAICoach } from "@/lib/nutri-ai-coach";
import {
  answerCoachPrompt,
  dismissCoachPrompt,
  dismissCoachMoment,
  getCoachState,
  markCoachPromptSeen,
  markCoachNotHelpful,
  markCoachSeen,
  onCoachStateChange,
} from "@/lib/nutri-ai-coach-state";
import { haptic } from "@/lib/haptics";

interface TodayScreenProps {
  goals: Goals;
  meals: Meal[];
  userId?: string | null;
  userProfile?: any;
  onDeleteMeal: (id: string) => void;
  onGoLog: (prefillText?: string) => void;
  onGoHistory?: () => void;
  onPickSuggestion?: (mealName: string) => void;
  onOpenXP?: () => void;
  onStartCheckin?: () => void;
}

const MEAL_EMOJI: Record<MealType, string> = {
  Breakfast: "\u{1F305}",
  Lunch: "\u2600\uFE0F",
  Dinner: "\u{1F319}",
  Snack: "\u{1F34E}",
};

const TRAINING_BURN: Record<string, number> = {
  Strength: 350, Cardio: 450, Cycling: 500, Bouldering: 400, Other: 300,
};
function trainingBurn(t: TrainingEntry | null): number {
  if (!t) return 0;
  return TRAINING_BURN[t.type] ?? 300;
}

function dateFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(d: Date) {
  const monday = new Date(d);
  const diffToMon = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - diffToMon);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/* -- SVG speedometer arc -- */
function CalorieArc({ pct, remaining }: { pct: number; remaining: number }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimPct(pct));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAnimPct(pct); }, [pct]);

  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const endAngle = 405;
  const polar = (a: number) => ({
    x: cx + r * Math.cos((a * Math.PI) / 180),
    y: cy + r * Math.sin((a * Math.PI) / 180),
  });
  const p1 = polar(startAngle);
  const p2 = polar(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const trackPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
  const clamped = Math.max(0, Math.min(100, animPct));
  const sweep = ((endAngle - startAngle) * clamped) / 100;
  const pf = polar(startAngle + sweep);
  const fillLarge = sweep > 180 ? 1 : 0;
  const fillPath =
    clamped > 0 ? `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${fillLarge} 1 ${pf.x} ${pf.y}` : "";

  return (
    <div className="relative" style={{ width: size, height: size * 0.78 }}>
      <svg width={size} height={size} className="absolute inset-0">
        <path d={trackPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke="hsl(var(--primary))" strokeWidth={stroke} strokeLinecap="round"
            style={{ transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <div className="font-mono-data text-5xl font-bold tracking-tight text-foreground tabular-nums">
          {Math.round(Math.max(0, remaining)).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-1">kcal left</div>
      </div>
    </div>
  );
}

function personalizedTone(status?: RuleStatus) {
  switch (status) {
    case "bad":
      return {
        color: "hsl(var(--destructive))",
        bg: "hsl(var(--destructive) / 0.10)",
        border: "hsl(var(--destructive) / 0.35)",
        note: "Watch this",
      };
    case "caution":
      return {
        color: "hsl(38 92% 50%)",
        bg: "hsl(38 100% 96%)",
        border: "hsl(38 80% 75%)",
        note: "Could improve",
      };
    case "good":
      return {
        color: "hsl(142 70% 42%)",
        bg: "hsl(142 55% 95%)",
        border: "hsl(142 45% 75%)",
        note: "Good for you",
      };
    default:
      return null;
  }
}

function MacroChip({
  label, current, goal, colorVar, summary,
}: {
  label: string; current: number; goal: number; colorVar: string; summary?: MetricStatusSummary;
}) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const over = current > goal;
  const tone = personalizedTone(summary?.status);
  const baseColor = over ? "hsl(var(--destructive))" : `hsl(var(${colorVar}))`;
  const activeColor = tone?.color ?? baseColor;
  return (
    <div
      className="flex-1 rounded-2xl border bg-card p-3 flex flex-col gap-1.5"
      style={{
        borderColor: tone?.border ?? "hsl(var(--border))",
        backgroundColor: tone?.bg ?? "hsl(var(--card))",
      }}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-mono-data text-base font-semibold tabular-nums"
          style={{ color: activeColor }}>{Math.round(current)}</span>
        <span className="font-mono-data text-[11px] text-muted-foreground">/{Math.round(goal)}g</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {summary && (
        <div className="text-[9px] uppercase tracking-wider" style={{ color: activeColor }}>
          {tone?.note}
        </div>
      )}
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: activeColor }} />
      </div>
    </div>
  );
}

function MacroDetailCard({
  label, current, goal, unit, colorVar, summary,
}: {
  label: string; current: number; goal: number; unit: string; colorVar: string; summary?: MetricStatusSummary;
}) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const over = current > goal;
  const tone = personalizedTone(summary?.status);
  const color = tone?.color ?? (over ? "hsl(var(--destructive))" : `hsl(var(${colorVar}))`);
  return (
    <div
      className="rounded-[20px] border bg-card p-5 flex flex-col gap-2"
      style={{
        borderColor: tone?.border ?? "hsl(var(--border))",
        backgroundColor: tone?.bg ?? "hsl(var(--card))",
      }}
    >
      <div className="nouri-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono-data text-3xl font-bold tabular-nums leading-none" style={{ color }}>{Math.round(current)}</span>
        <span className="font-mono-data text-xs text-muted-foreground">/{Math.round(goal)}{unit}</span>
      </div>
      {summary && (
        <div className="text-[10px] uppercase tracking-wider" style={{ color }}>
          {tone?.note} {summary.conditions.length ? `· ${summary.conditions[0]}` : ""}
        </div>
      )}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MicroCard({
  metric, current, goal, summary,
}: {
  metric: Metric; current: number; goal: number; summary?: MetricStatusSummary;
}) {
  const meta = METRIC_META[metric];
  const isLimit = LIMIT_METRICS.has(metric);
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const reached = !isLimit && goal > 0 && current >= goal;
  const overLimit = isLimit && current > goal;
  const amber = "hsl(38 92% 50%)";
  const red = "hsl(var(--destructive))";
  const green = "hsl(142 70% 42%)";
  const tone = personalizedTone(summary?.status);
  const baseBarColor = overLimit ? red : isLimit ? amber : reached ? green : meta.color;
  const barColor = tone?.color ?? baseBarColor;
  const valueColor = tone?.color ?? (overLimit ? red : current > 0 ? (isLimit ? amber : reached ? green : meta.color) : "hsl(var(--muted-foreground))");
  return (
    <div className="rounded-2xl border p-3 flex flex-col gap-1"
      style={{
        backgroundColor: tone?.bg ?? (overLimit ? "hsl(var(--destructive) / 0.10)" : "hsl(var(--card))"),
        borderColor: tone?.border ?? (overLimit ? "hsl(var(--destructive) / 0.40)" : "hsl(var(--border))"),
      }}>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{meta.label}</div>
        {summary?.status === "bad" && <AlertTriangle size={11} style={{ color: red }} aria-hidden />}
        {summary?.status === "good" && <Check size={11} style={{ color: green }} aria-hidden />}
        {!summary && overLimit && <AlertTriangle size={11} style={{ color: red }} aria-hidden />}
        {!summary && reached && <Check size={11} style={{ color: green }} aria-hidden />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono-data text-base font-semibold tabular-nums" style={{ color: valueColor }}>{Math.round(current)}</span>
        <span className="font-mono-data text-[10px] text-muted-foreground">/{Math.round(goal)}{meta.unit}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {summary && (
        <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: valueColor }}>
          {tone?.note}
        </div>
      )}
      {!summary && overLimit && <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: red }}>Over limit</div>}
    </div>
  );
}

/* =================== MAIN COMPONENT =================== */

export function TodayScreen({
  goals, meals, userId, userProfile, onDeleteMeal, onGoLog, onGoHistory, onPickSuggestion, onOpenXP, onStartCheckin,
}: TodayScreenProps) {
  const lang = useLanguage();
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const swipeStartX = useRef<number | null>(null);
  const [waterMl, setWaterMl] = useState(() => getWaterIntakeForDate(todayISO(), userId));
  const selectedMeals = meals.filter((m) => m.date === selectedDate);
  const sum = selectedMeals.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const isSelectedToday = selectedDate === today;

  useEffect(() => {
    const refresh = () => setWaterMl(getWaterIntakeForDate(selectedDate, userId));
    refresh();
    window.addEventListener("water:updated", refresh);
    return () => window.removeEventListener("water:updated", refresh);
  }, [selectedDate, userId]);

  const handleAddWater = useCallback((amount: WaterQuickAmount) => {
    setWaterMl(addWaterIntakeForDate(selectedDate, WATER_AMOUNTS_ML[amount], userId));
  }, [selectedDate, userId]);

  const dateLabel = dateFromISO(selectedDate).toLocaleDateString(getLocale(lang), { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const [streak, setStreak] = useState(() => getStreak(userId));
  const [freezes, setFreezes] = useState(() => getFreezes(userId));
  const [xp, setXp] = useState(() => getTotalXP(userId));
  const prevStreak = useRef<number>(streak.count);
  const [streakBump, setStreakBump] = useState(false);
  useEffect(() => {
    const refresh = () => { setStreak(getStreak(userId)); setFreezes(getFreezes(userId)); setXp(getTotalXP(userId)); };
    refresh();
    window.addEventListener("streak:updated", refresh);
    window.addEventListener("xp:awarded", refresh);
    return () => { window.removeEventListener("streak:updated", refresh); window.removeEventListener("xp:awarded", refresh); };
  }, [meals, userId]);

  useEffect(() => {
    if (streak.count !== prevStreak.current) {
      prevStreak.current = streak.count;
      setStreakBump(true);
      window.setTimeout(() => setStreakBump(false), 220);
    }
  }, [streak.count]);

  const goalsQ = useGoals();
  const baseExt: ExtendedGoals = goalsQ.data?.extended ?? { ...goals };

  const [training, setTraining] = useState<TrainingEntry | null>(() => getTodayTraining(userId));
  const [trainingSheetOpen, setTrainingSheetOpen] = useState(false);

  // Effective goals = base extended goals (from cloud) adjusted for today's training.
  const selectedTraining = isSelectedToday ? training : null;
  const effective: ExtendedGoals = useMemo(
    () => (selectedTraining ? computeTodayGoals(baseExt, selectedTraining.type) : baseExt),
    [baseExt, selectedTraining],
  );

  useEffect(() => {
    const refresh = () => setTraining(getTodayTraining(userId));
    window.addEventListener("training:updated", refresh);
    return () => window.removeEventListener("training:updated", refresh);
  }, [userId]);

  // Award XP when training gets logged (once per day).
  useEffect(() => {
    checkTrainingAward(!!training, userId);
  }, [training, userId]);

  const { alerts: nutrientAlerts, dismiss: dismissNutrientAlert } = useNutrientAlerts(
    selectedMeals,
    goalsQ.data?.extended,
    userProfile ?? null,
    userId,
    selectedDate,
  );

  const [layout, setLayout] = useState<DashboardLayout>(() => getStoredLayout(userId) ?? DEFAULT_LAYOUT);
  const [adjustOpen, setAdjustOpen] = useState(false);
  useEffect(() => {
    const refresh = () => { const stored = getStoredLayout(userId); if (stored) setLayout(stored); };
    refresh();
    return onLayoutChange(refresh);
  }, [userId]);

  const burned = trainingBurn(selectedTraining);
  const eGoals = {
    calories: effective.calories || goals.calories,
    protein: effective.protein || goals.protein,
    carbs: effective.carbs || goals.carbs,
    fat: effective.fat || goals.fat,
  };
  const displayedProteinGoal = eGoals.protein;
  const remaining = Math.max(0, eGoals.calories - sum.calories);
  const calPct = (sum.calories / eGoals.calories) * 100;

  const weekDays = useMemo(() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const todayStr = todayISO();
    const loggedDates = new Set(meals.map((m) => m.date));
    return labels.map((label, i) => {
      const d = addDays(weekStart, i);
      const iso = isoDateLocal(d);
      return {
        label,
        day: d.getDate(),
        iso,
        isSelected: iso === selectedDate,
        isToday: iso === todayStr,
        isFuture: iso > todayStr,
        logged: loggedDates.has(iso),
      };
    });
  }, [meals, selectedDate, weekStart]);

  const tip = useMemo(() => {
    const remP = Math.max(0, displayedProteinGoal - sum.protein);
    const remC = Math.max(0, eGoals.calories - sum.calories);
    if (remP <= 0 && remC <= 0) return "You've hit your goals for the day - well done. Stay light tonight.";
    if (sum.calories === 0) return `Fresh start. ${Math.round(eGoals.calories)} kcal and ${Math.round(displayedProteinGoal)}g protein to go.`;
    if (remP > 30) return `You need ${Math.round(remP)}g more protein and ${Math.round(remC)} kcal today. Make dinner count!`;
    if (remC < 300) return `Almost there - only ${Math.round(remC)} kcal left. Keep it light.`;
    return `${Math.round(remC)} kcal and ${Math.round(remP)}g protein remaining. You're on track.`;
  }, [sum, eGoals, displayedProteinGoal]);

  const streakActive = streak.count > 0 && (streak.lastLogDate === today || streak.lastLogDate === (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })());

  const fiberGoal = goalForMetric("fiber", eGoals);
  const fiberCurrent = totalForMetric("fiber", selectedMeals);
  const [coachState, setCoachState] = useState(() => getCoachState(userId));
  const metricTotals = useMemo(() => ({
    calories: sum.calories,
    protein: sum.protein,
    carbs: sum.carbs,
    fat: sum.fat,
    fiber: totalForMetric("fiber" as any, selectedMeals),
    sugar: totalForMetric("sugar" as any, selectedMeals),
    sodium: totalForMetric("sodium" as any, selectedMeals),
    potassium: totalForMetric("potassium" as any, selectedMeals),
    cholesterol: totalForMetric("cholesterol" as any, selectedMeals),
    saturated_fat: totalForMetric("saturated_fat" as any, selectedMeals),
    iron: totalForMetric("iron" as any, selectedMeals),
    vitamin_c: totalForMetric("vitamin_c" as any, selectedMeals),
    vitamin_d: totalForMetric("vitamin_d" as any, selectedMeals),
    vitamin_a: totalForMetric("vitamin_a" as any, selectedMeals),
    calcium: totalForMetric("calcium" as any, selectedMeals),
  }), [sum, selectedMeals]);
  const conditionRuleMap = useMemo(
    () => evaluateConditionRules({
      conditions: userProfile?.conditions ?? [],
      totals: metricTotals,
      goals: { calories: eGoals.calories, protein: eGoals.protein, ...effective as any },
    }),
    [userProfile?.conditions, metricTotals, eGoals.calories, eGoals.protein, effective],
  );
  const metricSummaries = useMemo(
    () => summarizeMetricStatuses(conditionRuleMap),
    [conditionRuleMap],
  );
  const coachMessage = useMemo(
    () => buildNutriAICoach({
      meals: selectedMeals,
      goals,
      extendedGoals: effective,
      userProfile: userProfile ?? null,
      coachState,
    }),
    [selectedMeals, goals, effective, userProfile, coachState],
  );
  const coachDismissed =
    !!coachState.dismissedCheckIns[coachMessage.window] ||
    (!!coachState.notHelpfulCheckIns[coachMessage.window] && !coachState.feedbackReasons[coachMessage.window]) ||
    coachState.feedbackReasons[coachMessage.window] === "not_relevant" ||
    !coachMessage.shouldShow;
  const [coachPromptOpen, setCoachPromptOpen] = useState(false);
  const lastPromptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const refresh = () => setCoachState(getCoachState(userId));
    refresh();
    return onCoachStateChange(refresh);
  }, [userId]);

  useEffect(() => {
    if (!coachDismissed) {
      markCoachSeen(coachMessage.window, coachMessage.priorityNutrients[0]?.nutrientId, userId);
    }
  }, [coachDismissed, coachMessage.window, coachMessage.priorityNutrients, userId]);

  useEffect(() => {
    const prompt = coachMessage.interactivePrompt;
    if (!prompt?.shouldPrompt || coachDismissed) return;
    if (lastPromptKeyRef.current === prompt.key) return;
    lastPromptKeyRef.current = prompt.key;
    setCoachPromptOpen(true);
    markCoachPromptSeen(prompt.key, userId);
  }, [coachDismissed, coachMessage.interactivePrompt, userId]);

  const handleCoachPromptOpenChange = useCallback((open: boolean) => {
    setCoachPromptOpen(open);
    if (!open && coachMessage.interactivePrompt) {
      dismissCoachPrompt(coachMessage.interactivePrompt.key, userId);
    }
  }, [coachMessage.interactivePrompt, userId]);

  const handleCoachPromptOption = useCallback((optionId: string) => {
    const prompt = coachMessage.interactivePrompt;
    if (!prompt) return;
    const option = prompt.options.find((item) => item.id === optionId);
    answerCoachPrompt(prompt.key, option?.label ?? optionId, userId);
    setCoachPromptOpen(false);
    if (option?.action === "log_meal") {
      onGoLog(option.prefillText);
    }
  }, [coachMessage.interactivePrompt, onGoLog, userId]);

  const changeWeek = useCallback((direction: -1 | 1) => {
    setWeekStart((current) => addDays(current, direction * 7));
  }, []);

  /* -- Widget renderer -- */
  const renderWidget = useCallback((widget: WidgetItem) => {
    switch (widget.type) {
      case "calorie-arc":
        return (
          <section className="rounded-[24px] border border-border bg-card p-6 flex flex-col items-center gap-5 h-full">
            <CalorieArc pct={calPct} remaining={remaining} />
            <div className="grid grid-cols-3 w-full divide-x divide-border">
              <div className="flex flex-col items-center px-2">
                <div className="font-mono-data text-xl font-bold tabular-nums" style={{ color: "hsl(var(--primary))" }}>{Math.round(sum.calories).toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Consumed</div>
              </div>
              <div className="flex flex-col items-center px-2">
                <div className="font-mono-data text-xl font-bold tabular-nums text-foreground">{Math.round(eGoals.calories).toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Goal</div>
              </div>
              <div className="flex flex-col items-center px-2">
                <div className="font-mono-data text-xl font-bold tabular-nums" style={{ color: "hsl(var(--macro-carbs))" }}>{Math.round(burned).toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Burned</div>
              </div>
            </div>
          </section>
        );

      case "macros":
        return (
          <div className="flex gap-2 w-full h-full">
            <MacroChip label="Protein" current={sum.protein} goal={displayedProteinGoal} colorVar="--macro-protein" summary={metricSummaries.protein} />
            <MacroChip label="Carbs" current={sum.carbs} goal={eGoals.carbs} colorVar="--macro-carbs" summary={metricSummaries.carbs} />
            <MacroChip label="Fat" current={sum.fat} goal={eGoals.fat} colorVar="--macro-fat" summary={metricSummaries.saturated_fat ?? metricSummaries.fat} />
          </div>
        );

      case "macro-protein":
        return <MacroDetailCard label="Protein" current={sum.protein} goal={displayedProteinGoal} unit="g" colorVar="--macro-protein" summary={metricSummaries.protein} />;
      case "macro-carbs":
        return <MacroDetailCard label="Carbs" current={sum.carbs} goal={eGoals.carbs} unit="g" colorVar="--macro-carbs" summary={metricSummaries.carbs} />;
      case "macro-fat":
        return <MacroDetailCard label="Fat" current={sum.fat} goal={eGoals.fat} unit="g" colorVar="--macro-fat" summary={metricSummaries.saturated_fat ?? metricSummaries.fat} />;
      case "macro-fiber":
        return <MacroDetailCard label="Fiber" current={fiberCurrent} goal={fiberGoal} unit="g" colorVar="--macro-protein" summary={metricSummaries.fiber} />;

      case "micros":
        return layout.small.length > 0 ? (
          <div className="space-y-2 h-full">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">Micronutrients</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily targets</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {layout.small.map((m) => (
                <MicroCard key={m} metric={m} current={totalForMetric(m, selectedMeals)} goal={goalForMetric(m, eGoals)} summary={metricSummaries[m]} />
              ))}
            </div>
          </div>
        ) : null;

      case "tip":
        return (
          <div className="rounded-2xl border p-4 flex items-start gap-3 h-full"
            style={{ backgroundColor: "hsl(var(--primary) / 0.10)", borderColor: "hsl(var(--primary) / 0.30)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: "hsl(var(--primary) / 0.18)" }} aria-hidden>{"\u{1F31F}"}</div>
            <p className="text-sm leading-relaxed text-foreground/90 pt-0.5">{tip}</p>
          </div>
        );

      case "training":
        if (!isSelectedToday) return null;
        return training ? (
          <div className="rounded-2xl border p-3 flex items-center gap-3 h-full"
            style={{ backgroundColor: "hsl(var(--macro-carbs) / 0.10)", borderColor: "hsl(var(--macro-carbs) / 0.35)" }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "hsl(var(--macro-carbs) / 0.18)" }} aria-hidden>
              <Dumbbell size={16} style={{ color: "hsl(var(--macro-carbs))" }} />
            </span>
            <p className="text-xs leading-relaxed text-foreground/90">Training day targets active - goals adjusted for recovery.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setTrainingSheetOpen(true)}
            className="w-full rounded-2xl border border-border bg-card p-3 flex items-center gap-3 transition-transform active:scale-[0.99] h-full">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "hsl(var(--macro-carbs) / 0.15)" }} aria-hidden>
              <Dumbbell size={18} style={{ color: "hsl(var(--macro-carbs))" }} />
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-foreground">{t("logTraining", lang)}</div>
              <div className="text-[11px] text-muted-foreground">{t("trainingBumps", lang, { n: TRAINING_PROTEIN_BONUS })}</div>
            </div>
          </button>
        );

      case "meals":
        return (
          <section className="space-y-2 h-full">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">{isSelectedToday ? "Today's meals" : "Meals"}</h2>
              {onGoHistory && <button onClick={onGoHistory} className="text-xs text-primary hover:underline">View all</button>}
            </div>
            {selectedMeals.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-4">{t("nothingLoggedYet", lang)}</p>
            ) : (
              <div className="space-y-2">
                {selectedMeals.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="text-xl shrink-0" aria-hidden>{MEAL_EMOJI[m.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{m.meal_name}</div>
                      <div className="text-xs text-muted-foreground">{m.type} · {Math.round(m.protein)}g protein</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-data text-sm font-semibold tabular-nums text-foreground">{Math.round(m.calories)}</div>
                      <div className="font-mono-data text-[10px] text-muted-foreground">kcal</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case "log-button":
        return (
          <button onClick={() => onGoLog()}
            className="w-full rounded-2xl border-2 border-dashed py-5 px-4 flex items-center justify-center gap-2 font-medium transition-colors h-full"
            style={{ borderColor: "hsl(var(--primary) / 0.45)", backgroundColor: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}>
            <Mic size={18} />
            Log a meal with voice or text
          </button>
        );

      default:
        return null;
    }
  }, [calPct, remaining, sum, eGoals, burned, displayedProteinGoal, fiberCurrent, fiberGoal, tip, training, selectedMeals, meals, layout, lang, onGoLog, onGoHistory, isSelectedToday]);

  /* -- Header slot (non-widget sections) -- */
  const headerSlot = (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nutri AI</h1>
          <p className="font-mono-data text-[11px] text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>
        <button type="button" onClick={onOpenXP}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-medium shadow-sm transition-transform active:scale-95 ${streakBump ? "animate-nouri-pop" : ""}`}
          aria-label="Streak">
          <Flame size={14}
            style={{ color: streakActive ? "hsl(var(--macro-carbs))" : "hsl(var(--muted-foreground))" }}
            fill={streakActive ? "hsl(var(--macro-carbs))" : "none"} />
          <span className="font-mono-data tabular-nums">{streak.count}</span>
          <span className="text-xs text-muted-foreground">days</span>
          <span className="text-xs text-muted-foreground border-l border-border pl-1.5">
            {freezes} freeze{freezes === 1 ? "" : "s"}
          </span>
        </button>
      </header>

      {/* Week strip — Apple-style pill row */}
      <div
        className="flex items-center gap-2"
        onTouchStart={(e) => { swipeStartX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          if (swipeStartX.current == null) return;
          const delta = e.changedTouches[0].clientX - swipeStartX.current;
          swipeStartX.current = null;
          if (Math.abs(delta) < 40) return;
          haptic("light");
          changeWeek(delta < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => { haptic("light"); changeWeek(-1); }}
          className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {weekDays.map((d) => {
            const isSelected = d.isSelected;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => { haptic("light"); setSelectedDate(d.iso); }}
                className={[
                  "relative h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5",
                  "text-[10px] font-medium tracking-wide uppercase",
                  "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "active:scale-[0.92]",
                  isSelected
                    ? "bg-foreground text-background shadow-[0_8px_20px_-8px_hsl(var(--foreground)/0.35)] scale-[1.04]"
                    : d.logged
                      ? "bg-primary/10 text-foreground"
                      : d.isFuture
                        ? "bg-transparent text-muted-foreground/50"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                ].join(" ")}
                aria-pressed={isSelected}
                aria-label={dateFromISO(d.iso).toLocaleDateString(getLocale(lang), { weekday: "long", month: "long", day: "numeric" })}
              >
                <span className="opacity-70">{d.label}</span>
                <span className="font-mono-data text-[13px] tabular-nums leading-none">
                  {d.day}
                </span>
                {d.logged && !isSelected && (
                  <span
                    className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { haptic("light"); changeWeek(1); }}
          className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {isSelectedToday && <EveningNudge meals={meals} onGoLog={onGoLog} />}

      {/* 1-tap re-log: repeat last meal + saved favorites. No AI call. */}
      {isSelectedToday && <QuickLogStrip meals={meals} />}

      {/* Condition-specific nutrient alerts */}
      {userProfile?.conditions?.length > 0 && (
        <ConditionAlertCards
          conditions={userProfile.conditions}
          totals={{
            ...metricTotals,
            saturated_fat: totalForMetric("saturated_fat" as any, selectedMeals),
            b12: 0,
            zinc: 0,
            folate: 0,
            selenium: 0,
            omega3: 0,
            magnesium: 0,
            iodine: 0,
          }}
          goals={{
            calories: eGoals.calories,
            protein: eGoals.protein,
            ...(effective as any),
          }}
        />
      )}

      {!coachDismissed && (
        <CoachCard
          message={coachMessage}
          onDismiss={() => dismissCoachMoment(coachMessage.window, userId)}
          onNotHelpful={(reason) => markCoachNotHelpful(coachMessage.window, userId, reason, coachMessage.priorityNutrients[0])}
          onPrimaryAction={() => {
            if (onGoLog) onGoLog();
          }}
        />
      )}

      {isCheckinDue(localStorage.getItem("nouri:signupDate")) && onStartCheckin && (
        <button type="button" onClick={onStartCheckin}
          className="w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-transform active:scale-[0.99]"
          style={{ backgroundColor: "hsl(var(--primary) / 0.10)", borderColor: "hsl(var(--primary) / 0.30)" }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{t("weeklyCheckinTitle", lang)}</div>
            <div className="text-xs mt-0.5 text-muted-foreground">{t("weeklyCheckinSub", lang)}</div>
          </div>
          <span className="text-xs font-medium px-3 py-1.5 rounded-full text-primary-foreground shrink-0"
            style={{ backgroundColor: "hsl(var(--primary))" }}>{t("letsGo", lang)}</span>
        </button>
      )}
    </>
  );

  return (
    <div className="px-5 pt-4 pb-36 max-w-md mx-auto space-y-5">
      {coachMessage.interactivePrompt && (
        <CoachPromptDialog
          open={coachPromptOpen}
          message={coachMessage}
          prompt={coachMessage.interactivePrompt}
          onOpenChange={handleCoachPromptOpenChange}
          onOptionSelect={handleCoachPromptOption}
        />
      )}

      {headerSlot}

      {/* Primary focus block: only the metrics that matter */}
      <TodayFocus
        caloriesCurrent={sum.calories}
        caloriesGoal={eGoals.calories}
        proteinCurrent={sum.protein}
        proteinGoal={displayedProteinGoal}
        tip={tip}
        alerts={nutrientAlerts}
        onDismissAlert={dismissNutrientAlert}
        waterMl={waterMl}
        onAddWater={handleAddWater}
      />

      {/* Today's meals list - kept visible since it's contextual to logging */}
      {renderWidget({ id: "meals", type: "meals" } as WidgetItem)}

      {/* Quick log CTA */}
      {renderWidget({ id: "log-button", type: "log-button" } as WidgetItem)}

      {/* Macros - horizontal side scroll (Cal AI-like) */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-semibold text-foreground">Macros</h2>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Swipe <span aria-hidden>{"\u2192"}</span>
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-2 scrollbar-none scroll-smooth [scroll-padding-inline:1.25rem] [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]">
          <div className="snap-center shrink-0 w-[60%] min-w-[180px]">
            {renderWidget({ id: "macro-protein", type: "macro-protein" } as WidgetItem)}
          </div>
          <div className="snap-center shrink-0 w-[60%] min-w-[180px]">
            {renderWidget({ id: "macro-carbs", type: "macro-carbs" } as WidgetItem)}
          </div>
          <div className="snap-center shrink-0 w-[60%] min-w-[180px]">
            {renderWidget({ id: "macro-fat", type: "macro-fat" } as WidgetItem)}
          </div>
          <div className="snap-center shrink-0 w-[60%] min-w-[180px]">
            {renderWidget({ id: "macro-fiber", type: "macro-fiber" } as WidgetItem)}
          </div>
        </div>
      </section>

      {/* Micros - horizontal side scroll */}
      {layout.small.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">Micronutrients</h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Swipe <span aria-hidden>{"\u2192"}</span>
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-2 scrollbar-none scroll-smooth [scroll-padding-inline:1.25rem] [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]">
            {layout.small.map((m) => (
              <div key={m} className="snap-center shrink-0 w-[42%] min-w-[130px]">
                <MicroCard metric={m} current={totalForMetric(m, selectedMeals)} goal={goalForMetric(m, eGoals)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Training */}
      {renderWidget({ id: "training", type: "training" } as WidgetItem)}

      <TrainingSheet open={trainingSheetOpen} onClose={() => setTrainingSheetOpen(false)}
        onPick={(type, calories) => { saveTodayTraining(type, calories, userId); haptic("medium"); setTrainingSheetOpen(false); }} />
      <AdjustDashboardSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} userId={userId}
        profile={userProfile} goals={goals} currentLayout={layout} onUpdated={(l) => setLayout(l)} />
    </div>
  );
}
