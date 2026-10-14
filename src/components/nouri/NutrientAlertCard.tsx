import { AlertTriangle, TrendingDown, X } from "lucide-react";
import type { NutrientAlert } from "@/lib/nouri-nutrient-alerts";

interface NutrientAlertCardProps {
  alert: NutrientAlert;
  onDismiss: () => void;
}

const LEVEL_STYLES = {
  exceeded: {
    bg: "hsl(var(--destructive) / 0.08)",
    border: "hsl(var(--destructive) / 0.30)",
    iconBg: "hsl(var(--destructive) / 0.15)",
    iconColor: "hsl(var(--destructive))",
    labelColor: "hsl(var(--destructive))",
    Icon: AlertTriangle,
  },
  warning: {
    bg: "hsl(38 100% 97%)",
    border: "hsl(38 80% 72%)",
    iconBg: "hsl(38 90% 90%)",
    iconColor: "hsl(32 90% 40%)",
    labelColor: "hsl(32 80% 38%)",
    Icon: AlertTriangle,
  },
  low: {
    bg: "hsl(210 100% 97%)",
    border: "hsl(210 80% 75%)",
    iconBg: "hsl(210 80% 90%)",
    iconColor: "hsl(210 80% 45%)",
    labelColor: "hsl(210 70% 40%)",
    Icon: TrendingDown,
  },
} as const;

export function NutrientAlertCard({ alert, onDismiss }: NutrientAlertCardProps) {
  const s = LEVEL_STYLES[alert.level];
  const { Icon } = s;
  const pctDisplay = Math.min(Math.round(alert.pct), alert.level === "exceeded" ? 999 : 100);

  return (
    <div
      className="rounded-2xl p-3 flex gap-3 items-start animate-[nouri-bubble-in_0.2s_ease]"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
      role="alert"
    >
      {/* Icon */}
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: s.iconBg }}
        aria-hidden
      >
        <Icon size={13} style={{ color: s.iconColor }} />
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.labelColor }}>
            {alert.label}
          </span>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: s.border }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(pctDisplay, 100)}%`,
                backgroundColor: s.iconColor,
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: s.labelColor }}>
            {alert.level === "exceeded" ? `+${Math.round(Math.abs(alert.consumed - alert.limit))}${alert.unit}` : `${Math.round(alert.pct)}%`}
          </span>
        </div>

        <p className="text-xs font-medium text-foreground leading-snug">{alert.message}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{alert.advice}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors"
        aria-label="Dismiss alert"
      >
        <X size={12} className="text-muted-foreground" />
      </button>
    </div>
  );
}

//  Stacked list of alerts with +N overflow 

interface NutrientAlertStackProps {
  alerts: NutrientAlert[];
  onDismiss: (id: string, consumed: number) => void;
  maxVisible?: number;
}

export function NutrientAlertStack({ alerts, onDismiss, maxVisible = 2 }: NutrientAlertStackProps) {
  if (!alerts.length) return null;

  const visible = alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - visible.length;

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <NutrientAlertCard key={a.id} alert={a} onDismiss={() => onDismiss(a.id, a.consumed)} />
      ))}
      {hiddenCount > 0 && (
        <p className="text-[11px] text-muted-foreground text-center">
          +{hiddenCount} more {hiddenCount === 1 ? "alert" : "alerts"}  scroll up or dismiss to reveal
        </p>
      )}
    </div>
  );
}
