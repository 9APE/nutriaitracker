import { useEffect, useMemo, useState, useCallback } from "react";
import { ConditionAlertCards } from "@/components/nouri/ConditionAlertCards";

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
import { AlertTriangle, Check, Flame, Mic, Dumbbell } from "lucide-react";
import type { Goals, Meal, MealType } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { getStreak, getFreezes } from "@/lib/nouri-streak";
import { getTotalXP, getLevelInfo } from "@/lib/nouri-xp";
import { isCheckinDue } from "@/components/nouri/WeeklyCheckin";
import { EveningNudge } from "@/components/nouri/EveningNudge";
import { TrainingSheet } from "@/components/nouri/TrainingSheet";
import {
  getTodayTraining,
  saveTodayTraining,
  TRAINING_PROTEIN_BONUS,
  type TrainingEntry,
} from "@/lib/nouri-training";
import { useLanguage, t, getLocale } from "@/lib/nouri-i18n";
import {
  loadUserGoals,
  loadTodayGoals,
  saveTodayGoals,
  computeTodayGoals,
  onGoalsChange,
  type ExtendedGoals,
} from "@/lib/nouri-goals";
import { goalForMetric } from "@/lib/nouri-dashboard-layout";
import type { WidgetItem } from "@/lib/nouri-widget-layout";

interface TodayScreenProps {
  goals: Goals;
  meals: Meal[];
  userProfile?: any;
  onDeleteMeal: (id: string) => void;
  onGoLog: () => void;
  onGoHistory?: () => void;
  onPickSuggestion?: (mealName: string) => void;
  onOpenXP?: () => void;
  onStartCheckin?: () => void;
}

const MEAL_EMOJI: Record<MealType, string> = {
  Breakfast: "🌅",
  Lunch: "☀️",
  Dinner: "🌙",
  Snack: "🍎",
};

const TRAINING_BURN: Record<string, number> = {
  Strength: 350, Cardio: 450, Cycling: 500, Bouldering: 400, Other: 300,
};
function trainingBurn(t: TrainingEntry | null): number {
  if (!t) return 0;
  return TRAINING_BURN[t.type] ?? 300;
}

/* ── SVG speedometer arc ── */
function CalorieArc({ pct, remaining }: { pct: number; remaining: number }) {
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
  const clamped = Math.max(0, Math.min(100, pct));
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

function MacroChip({ label, current, goal, colorVar }: { label: string; current: number; goal: number; colorVar: string }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const over = current > goal;
  return (
    <div className="flex-1 rounded-2xl border border-border bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1">
        <span className="font-mono-data text-base font-semibold tabular-nums"
          style={{ color: over ? "hsl(var(--destructive))" : `hsl(var(${colorVar}))` }}>{Math.round(current)}</span>
        <span className="font-mono-data text-[11px] text-muted-foreground">/{Math.round(goal)}g</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: over ? "hsl(var(--destructive))" : `hsl(var(${colorVar}))` }} />
      </div>
    </div>
  );
}

function MacroDetailCard({ label, current, goal, unit, colorVar }: { label: string; current: number; goal: number; unit: string; colorVar: string }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const over = current > goal;
  const color = over ? "hsl(var(--destructive))" : `hsl(var(${colorVar}))`;
  return (
    <div className="rounded-[20px] border border-border bg-card p-5 flex flex-col gap-2">
      <div className="nouri-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono-data text-3xl font-bold tabular-nums leading-none" style={{ color }}>{Math.round(current)}</span>
        <span className="font-mono-data text-xs text-muted-foreground">/{Math.round(goal)}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MicroCard({ metric, current, goal }: { metric: Metric; current: number; goal: number }) {
  const meta = METRIC_META[metric];
  const isLimit = LIMIT_METRICS.has(metric);
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const reached = !isLimit && goal > 0 && current >= goal;
  const overLimit = isLimit && current > goal;
  const amber = "hsl(38 92% 50%)";
  const red = "hsl(var(--destructive))";
  const green = "hsl(142 70% 42%)";
  const barColor = overLimit ? red : isLimit ? amber : reached ? green : meta.color;
  const valueColor = overLimit ? red : current > 0 ? (isLimit ? amber : reached ? green : meta.color) : "hsl(var(--muted-foreground))";
  return (
    <div className="rounded-2xl border p-3 flex flex-col gap-1"
      style={{
        backgroundColor: overLimit ? "hsl(var(--destructive) / 0.10)" : "hsl(var(--card))",
        borderColor: overLimit ? "hsl(var(--destructive) / 0.40)" : "hsl(var(--border))",
      }}>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{meta.label}</div>
        {overLimit && <AlertTriangle size={11} style={{ color: red }} aria-hidden />}
        {reached && <Check size={11} style={{ color: green }} aria-hidden />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono-data text-base font-semibold tabular-nums" style={{ color: valueColor }}>{Math.round(current)}</span>
        <span className="font-mono-data text-[10px] text-muted-foreground">/{Math.round(goal)}{meta.unit}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {overLimit && <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: red }}>Over limit</div>}
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export function TodayScreen({
  goals, meals, userProfile, onDeleteMeal, onGoLog, onGoHistory, onPickSuggestion, onOpenXP, onStartCheckin,
}: TodayScreenProps) {
  const lang = useLanguage();
  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);
  const sum = todayMeals.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const dateLabel = new Date().toLocaleDateString(getLocale(lang), { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const [streak, setStreak] = useState(() => getStreak());
  const [xp, setXp] = useState(() => getTotalXP());
  useEffect(() => {
    const refresh = () => { setStreak(getStreak()); setXp(getTotalXP()); };
    refresh();
    window.addEventListener("streak:updated", refresh);
    window.addEventListener("xp:awarded", refresh);
    return () => { window.removeEventListener("streak:updated", refresh); window.removeEventListener("xp:awarded", refresh); };
  }, [meals]);

  const [training, setTraining] = useState<TrainingEntry | null>(() => getTodayTraining());
  const [trainingSheetOpen, setTrainingSheetOpen] = useState(false);
  const [effective, setEffective] = useState<ExtendedGoals>(() => loadTodayGoals() ?? loadUserGoals() ?? { ...goals });

  useEffect(() => {
    const recompute = () => {
      const t = getTodayTraining();
      setTraining(t);
      const base = loadUserGoals() ?? { ...goals };
      if (t) {
        const adjusted = computeTodayGoals(base, t.type);
        saveTodayGoals(adjusted);
        setEffective(adjusted);
      } else {
        setEffective(loadTodayGoals() ?? base);
      }
    };
    recompute();
    window.addEventListener("training:updated", recompute);
    const off = onGoalsChange(recompute);
    return () => { window.removeEventListener("training:updated", recompute); off(); };
  }, [goals]);

  const [layout, setLayout] = useState<DashboardLayout>(() => getStoredLayout() ?? DEFAULT_LAYOUT);
  const [adjustOpen, setAdjustOpen] = useState(false);
  useEffect(() => {
    const refresh = () => { const stored = getStoredLayout(); if (stored) setLayout(stored); };
    refresh();
    return onLayoutChange(refresh);
  }, []);

  const burned = trainingBurn(training);
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
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMon);
    monday.setHours(0, 0, 0, 0);
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const todayStr = todayISO();
    const loggedDates = new Set(meals.map((m) => m.date));
    return labels.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { label, iso, isToday: iso === todayStr, isFuture: iso > todayStr, logged: loggedDates.has(iso) };
    });
  }, [meals]);

  const tip = useMemo(() => {
    const remP = Math.max(0, displayedProteinGoal - sum.protein);
    const remC = Math.max(0, eGoals.calories - sum.calories);
    if (remP <= 0 && remC <= 0) return "You've hit your goals for the day — well done. Stay light tonight.";
    if (sum.calories === 0) return `Fresh start. ${Math.round(eGoals.calories)} kcal and ${Math.round(displayedProteinGoal)}g protein to go.`;
    if (remP > 30) return `You need ${Math.round(remP)}g more protein and ${Math.round(remC)} kcal today. Make dinner count!`;
    if (remC < 300) return `Almost there — only ${Math.round(remC)} kcal left. Keep it light.`;
    return `${Math.round(remC)} kcal and ${Math.round(remP)}g protein remaining. You're on track.`;
  }, [sum, eGoals, displayedProteinGoal]);

  const streakActive = streak.count > 0 && (streak.lastLogDate === today || streak.lastLogDate === (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })());

  const fiberGoal = goalForMetric("fiber", eGoals as Goals);
  const fiberCurrent = totalForMetric("fiber", meals);

  /* ── Widget renderer ── */
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
            <MacroChip label="Protein" current={sum.protein} goal={displayedProteinGoal} colorVar="--macro-protein" />
            <MacroChip label="Carbs" current={sum.carbs} goal={eGoals.carbs} colorVar="--macro-carbs" />
            <MacroChip label="Fat" current={sum.fat} goal={eGoals.fat} colorVar="--macro-fat" />
          </div>
        );

      case "macro-protein":
        return <MacroDetailCard label="Protein" current={sum.protein} goal={displayedProteinGoal} unit="g" colorVar="--macro-protein" />;
      case "macro-carbs":
        return <MacroDetailCard label="Carbs" current={sum.carbs} goal={eGoals.carbs} unit="g" colorVar="--macro-carbs" />;
      case "macro-fat":
        return <MacroDetailCard label="Fat" current={sum.fat} goal={eGoals.fat} unit="g" colorVar="--macro-fat" />;
      case "macro-fiber":
        return <MacroDetailCard label="Fiber" current={fiberCurrent} goal={fiberGoal} unit="g" colorVar="--macro-protein" />;

      case "micros":
        return layout.small.length > 0 ? (
          <div className="space-y-2 h-full">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">Micronutrients</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily targets</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {layout.small.map((m) => (
                <MicroCard key={m} metric={m} current={totalForMetric(m, meals)} goal={goalForMetric(m, eGoals as Goals)} />
              ))}
            </div>
          </div>
        ) : null;

      case "tip":
        return (
          <div className="rounded-2xl border p-4 flex items-start gap-3 h-full"
            style={{ backgroundColor: "hsl(var(--primary) / 0.10)", borderColor: "hsl(var(--primary) / 0.30)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: "hsl(var(--primary) / 0.18)" }} aria-hidden>🌿</div>
            <p className="text-sm leading-relaxed text-foreground/90 pt-0.5">{tip}</p>
          </div>
        );

      case "training":
        return training ? (
          <div className="rounded-2xl border p-3 flex items-center gap-3 h-full"
            style={{ backgroundColor: "hsl(var(--macro-carbs) / 0.10)", borderColor: "hsl(var(--macro-carbs) / 0.35)" }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "hsl(var(--macro-carbs) / 0.18)" }} aria-hidden>
              <Dumbbell size={16} style={{ color: "hsl(var(--macro-carbs))" }} />
            </span>
            <p className="text-xs leading-relaxed text-foreground/90">Training day targets active — goals adjusted for recovery.</p>
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
              <h2 className="text-base font-semibold text-foreground">Today's meals</h2>
              {onGoHistory && <button onClick={onGoHistory} className="text-xs text-primary hover:underline">View all</button>}
            </div>
            {todayMeals.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-4">{t("nothingLoggedYet", lang)}</p>
            ) : (
              <div className="space-y-2">
                {todayMeals.map((m) => (
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
          <button onClick={onGoLog}
            className="w-full rounded-2xl border-2 border-dashed py-5 px-4 flex items-center justify-center gap-2 font-medium transition-colors h-full"
            style={{ borderColor: "hsl(var(--primary) / 0.45)", backgroundColor: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}>
            <Mic size={18} />
            Log a meal with voice or text
          </button>
        );

      default:
        return null;
    }
  }, [calPct, remaining, sum, eGoals, burned, displayedProteinGoal, fiberCurrent, fiberGoal, tip, training, todayMeals, meals, layout, lang, onGoLog, onGoHistory]);

  /* ── Header slot (non-widget sections) ── */
  const headerSlot = (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">NutriAI</h1>
          <p className="font-mono-data text-[11px] text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>
        <button type="button" onClick={onOpenXP}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-medium shadow-sm transition-transform active:scale-95"
          aria-label="Streak">
          <Flame size={14}
            style={{ color: streakActive ? "hsl(var(--macro-carbs))" : "hsl(var(--muted-foreground))" }}
            fill={streakActive ? "hsl(var(--macro-carbs))" : "none"} />
          <span className="font-mono-data tabular-nums">{streak.count}</span>
          <span className="text-xs text-muted-foreground">days</span>
        </button>
      </header>

      {/* Week strip */}
      <div className="flex items-center justify-between">
        {weekDays.map((d, i) => {
          const base = "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium transition-colors";
          if (d.isToday) return <div key={i} className={`${base} bg-primary text-primary-foreground`}>{d.label}</div>;
          if (d.logged) return (
            <div key={i} className={`${base} border`}
              style={{ backgroundColor: "hsl(var(--primary) / 0.15)", borderColor: "hsl(var(--primary) / 0.35)", color: "hsl(var(--primary))" }}>
              <Check size={14} />
            </div>
          );
          if (d.isFuture) return <div key={i} className={`${base} border border-border text-muted-foreground bg-transparent`}>{d.label}</div>;
          return <div key={i} className={`${base} border border-border text-muted-foreground/70`}>{d.label}</div>;
        })}
      </div>

      <EveningNudge meals={meals} onGoLog={onGoLog} />

      {/* Condition-specific nutrient alerts */}
      {userProfile?.conditions?.length > 0 && (
        <ConditionAlertCards
          conditions={userProfile.conditions}
          totals={{
            iron: totalForMetric("iron", meals),
            calcium: totalForMetric("calcium", meals),
            vitamin_d: totalForMetric("vitamin_d", meals),
            vitamin_c: totalForMetric("vitamin_c", meals),
            fiber: totalForMetric("fiber", meals),
            sodium: totalForMetric("sodium", meals),
            potassium: totalForMetric("potassium", meals),
            protein: sum.protein,
            fat: sum.fat,
            b12: totalForMetric("b12", meals),
            zinc: totalForMetric("zinc", meals),
            folate: totalForMetric("folate", meals),
            selenium: totalForMetric("selenium", meals),
            sugar: totalForMetric("sugar", meals),
            cholesterol: totalForMetric("cholesterol", meals),
            omega3: totalForMetric("omega3", meals),
            magnesium: totalForMetric("magnesium", meals),
            iodine: totalForMetric("iodine", meals),
          }}
          goals={{
            calories: eGoals.calories,
            protein: eGoals.protein,
            ...(effective as any),
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
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto space-y-[14px]">
      <WidgetDashboard
        renderWidget={renderWidget}
        headerSlot={headerSlot}
      />

      <TrainingSheet open={trainingSheetOpen} onClose={() => setTrainingSheetOpen(false)}
        onPick={(type) => { saveTodayTraining(type); setTrainingSheetOpen(false); }} />
      <AdjustDashboardSheet open={adjustOpen} onClose={() => setAdjustOpen(false)}
        profile={userProfile} goals={goals} currentLayout={layout} onUpdated={(l) => setLayout(l)} />
    </div>
  );
}
