import { useState, useEffect, useRef } from "react";
import { Droplets, Flame } from "lucide-react";
import { NutrientAlertStack } from "@/components/nouri/NutrientAlertCard";
import type { NutrientAlert } from "@/lib/nouri-nutrient-alerts";
import { WATER_AMOUNTS_ML, type WaterQuickAmount } from "@/lib/nouri-storage";

interface TodayFocusProps {
  caloriesCurrent: number;
  caloriesGoal: number;
  proteinCurrent: number;
  proteinGoal: number;
  tip: string;
  alerts?: NutrientAlert[];
  onDismissAlert?: (id: string, consumed: number) => void;
  waterMl?: number;
  onAddWater?: (amount: WaterQuickAmount) => void;
}

/* Hero ring: a single, clear progress visualization for calories. */
function CalorieRing({ pct, remaining }: { pct: number; remaining: number }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimPct(pct));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAnimPct(pct); }, [pct]);

  const size = 200;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, animPct));
  const dash = (c * clamped) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Remaining
        </div>
        <div className="font-mono-data text-5xl font-bold tabular-nums text-foreground leading-none mt-1">
          {Math.round(Math.max(0, remaining)).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-1">kcal</div>
      </div>
    </div>
  );
}

/* Single linear protein bar  keeps the focus block to two metrics. */
function ProteinBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const over = current > goal;
  const color = over
    ? "hsl(var(--destructive))"
    : "hsl(var(--macro-protein))";
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Protein
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono-data text-base font-semibold tabular-nums"
            style={{ color }}
          >
            {Math.round(current)}
          </span>
          <span className="font-mono-data text-[11px] text-muted-foreground">
            / {Math.round(goal)}g
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function WaterView({
  waterMl,
  onAddWater,
}: {
  waterMl: number;
  onAddWater?: (amount: WaterQuickAmount) => void;
}) {
  const quickOptions: { id: WaterQuickAmount; label: string }[] = [
    { id: "sip", label: "Sip" },
    { id: "glass", label: "Glass" },
    { id: "bottle", label: "Bottle" },
  ];
  const liters = waterMl / 1000;

  return (
    <div className="w-full flex flex-col items-center gap-7">
      <div className="relative w-[200px] h-[200px] rounded-full border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-x-0 bottom-0 transition-all duration-700"
          style={{
            height: `${Math.min(100, (waterMl / 2000) * 100)}%`,
            backgroundColor: "hsl(196 90% 55% / 0.28)",
          }}
        />
        <div className="relative flex flex-col items-center">
          <Droplets size={28} style={{ color: "hsl(196 90% 42%)" }} />
          <div className="font-mono-data text-5xl font-bold tabular-nums text-foreground leading-none mt-3">
            {liters >= 1 ? liters.toFixed(1) : waterMl}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{liters >= 1 ? "L water" : "ml water"}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full">
        {quickOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onAddWater?.(option.id)}
            className="rounded-2xl border border-border bg-background px-3 py-3 text-center transition-transform active:scale-[0.98]"
          >
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            <span className="font-mono-data text-[11px] text-muted-foreground">
              +{WATER_AMOUNTS_ML[option.id]} ml
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TodayFocus({
  caloriesCurrent,
  caloriesGoal,
  proteinCurrent,
  proteinGoal,
  tip,
  alerts,
  onDismissAlert,
  waterMl = 0,
  onAddWater,
}: TodayFocusProps) {
  const [activeView, setActiveView] = useState<"nutrition" | "water">("nutrition");
  const swipeStartX = useRef<number | null>(null);
  const calPct = caloriesGoal > 0 ? (caloriesCurrent / caloriesGoal) * 100 : 0;
  const remaining = Math.max(0, caloriesGoal - caloriesCurrent);
  const showWater = activeView === "water";

  return (
    <section
      className="rounded-[28px] border border-border bg-card p-7 flex flex-col items-center gap-7"
      onTouchStart={(e) => { swipeStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (swipeStartX.current == null) return;
        const delta = e.changedTouches[0]?.clientX - swipeStartX.current;
        swipeStartX.current = null;
        if (Math.abs(delta) < 40) return;
        setActiveView(delta < 0 ? "water" : "nutrition");
      }}
    >
      {showWater ? (
        <WaterView waterMl={waterMl} onAddWater={onAddWater} />
      ) : (
        <>
          {/* Hero: calories ring + remaining */}
          <CalorieRing pct={calPct} remaining={remaining} />

          {/* Calories breakdown  minimal */}
          <div className="w-full flex items-center justify-center gap-6 text-center">
            <div className="flex flex-col">
              <span
                className="font-mono-data text-lg font-semibold tabular-nums"
                style={{ color: "hsl(var(--primary))" }}
              >
                {Math.round(caloriesCurrent).toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Eaten
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="font-mono-data text-lg font-semibold tabular-nums text-foreground">
                {Math.round(caloriesGoal).toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Goal
              </span>
            </div>
          </div>

          {/* Single secondary metric: protein */}
          <ProteinBar current={proteinCurrent} goal={proteinGoal} />
        </>
      )}

      <div className="flex items-center gap-2" aria-label="Today visual pages">
        {(["nutrition", "water"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className="h-2 rounded-full transition-all"
            style={{
              width: activeView === view ? 18 : 8,
              backgroundColor: activeView === view ? "hsl(var(--primary))" : "hsl(var(--muted))",
            }}
            aria-label={`Show ${view}`}
            aria-pressed={activeView === view}
          />
        ))}
      </div>

      {/* Nutrient limit alerts */}
      {!showWater && alerts && alerts.length > 0 && onDismissAlert && (
        <div className="w-full">
          <NutrientAlertStack alerts={alerts} onDismiss={onDismissAlert} />
        </div>
      )}

      {/* One key recommendation */}
      {!showWater && <div
        className="w-full rounded-2xl p-4 flex items-start gap-3"
        style={{
          backgroundColor: "hsl(var(--primary) / 0.08)",
          borderColor: "hsl(var(--primary) / 0.25)",
          borderWidth: 1,
        }}
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "hsl(var(--primary) / 0.18)" }}
          aria-hidden
        >
          <Flame size={16} style={{ color: "hsl(var(--primary))" }} />
        </span>
        <p className="text-sm leading-relaxed text-foreground/90 pt-0.5">
          {tip}
        </p>
      </div>}
    </section>
  );
}
