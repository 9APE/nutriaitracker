import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getActiveAlerts, type ActiveAlert } from "@/lib/condition-alerts";
import type { MealMicros } from "@/lib/nouri-storage";

interface Props {
  conditions: string[];
  /** Today's summed macro totals */
  macroTotals: { protein: number; fat: number };
  /** Today's summed micro totals */
  microTotals: Partial<MealMicros> & { [key: string]: number | undefined };
  /** Goal values — uses condition defaults when a goal is missing */
  goals: Record<string, number>;
}

function NutrientBar({ pct, status }: { pct: number; status: "amber" | "green" }) {
  const clamped = Math.min(pct, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted mt-1.5">
      <div
        className={cn(
          "h-1.5 rounded-full transition-all duration-500",
          status === "green" ? "bg-green-500" : "bg-amber-500"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function AlertCard({ alert }: { alert: ActiveAlert }) {
  const [expanded, setExpanded] = useState(false);
  const isGreen = alert.status === "green";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-sm transition-colors",
        isGreen
          ? "border-green-500/30 bg-green-500/8"
          : "border-amber-500/30 bg-amber-500/8"
      )}
    >
      <button
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isGreen ? (
              <CheckCircle2 size={14} className="text-green-500 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            )}
            <span className={cn("font-medium truncate", isGreen ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400")}>
              {alert.label}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(alert.pct)}%
            </span>
          </div>
          {expanded ? <ChevronUp size={13} className="text-muted-foreground shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
        </div>
        <NutrientBar pct={alert.pct} status={alert.status} />
      </button>

      {expanded && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isGreen ? alert.greenTip : alert.amberTip}
        </p>
      )}

      {alert.conflictWarning && (
        <p className="text-xs text-destructive mt-1.5 font-medium">
          ⚠ {alert.conflictWarning}
        </p>
      )}
    </div>
  );
}

export function MicronutrientAlerts({ conditions, macroTotals, microTotals, goals }: Props) {
  const totals: Record<string, number> = {
    protein: macroTotals.protein ?? 0,
    fat: macroTotals.fat ?? 0,
    ...Object.fromEntries(
      Object.entries(microTotals).filter(([, v]) => v !== undefined) as [string, number][]
    ),
  };

  const alerts = getActiveAlerts(conditions, totals, goals);

  if (!alerts.length) return null;

  const amberCount = alerts.filter((a) => a.status === "amber").length;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-sm font-medium text-foreground">Condition Alerts</h3>
        {amberCount > 0 && (
          <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5">
            {amberCount} to address
          </span>
        )}
      </div>
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <AlertCard key={`${alert.nutrient}-${i}`} alert={alert} />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground px-1">
        Not medical advice — consult your doctor or dietitian.
      </p>
    </section>
  );
}
