import { cn } from "@/lib/utils";
import { METRIC_META, isTracked, type Metric } from "@/lib/nouri-dashboard-layout";

interface Props {
  metric: Metric;
  current: number;
  goal: number;
  size: "large" | "medium";
}

/** Circular progress ring for a metric. */
export function MetricRing({ metric, current, goal, size }: Props) {
  const meta = METRIC_META[metric];
  const tracked = isTracked(metric);
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;

  const dim = size === "large" ? 132 : 96;
  const stroke = size === "large" ? 10 : 8;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      className={cn(
        "nouri-card flex flex-col items-center justify-center p-3 gap-1.5",
        size === "large" ? "py-5" : "py-3"
      )}
    >
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            stroke={meta.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {tracked ? (
            <>
              <span className={cn("font-mono-data leading-none text-foreground", size === "large" ? "text-2xl" : "text-lg")}>
                {Math.round(current)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                /{Math.round(goal)} {meta.unit}
              </span>
            </>
          ) : (
            <>
              <span className={cn("text-muted-foreground", size === "large" ? "text-base" : "text-sm")}>—</span>
              <span className="text-[10px] text-muted-foreground mt-1">{meta.unit}</span>
            </>
          )}
        </div>
      </div>
      <div className={cn("text-center font-medium text-foreground", size === "large" ? "text-sm" : "text-xs")}>
        {meta.label}
      </div>
    </div>
  );
}
