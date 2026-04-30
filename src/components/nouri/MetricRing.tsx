import { cn } from "@/lib/utils";
import { METRIC_META, isTracked, type Metric } from "@/lib/nouri-dashboard-layout";

interface Props {
  metric: Metric;
  current: number;
  goal: number;
  size: "large" | "medium";
}

/** Circular progress ring for a metric. Sizes itself to fill the card. */
export function MetricRing({ metric, current, goal, size }: Props) {
  const meta = METRIC_META[metric];
  const tracked = isTracked(metric);
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;

  // Use a viewBox so the SVG scales to the wrapper width.
  // Stroke is drawn relative to the viewBox: large=6/100, medium=8/100.
  const VB = 100;
  const stroke = size === "large" ? 6 : 8;
  const r = (VB - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  // Wrapper width — the ring fills available card width up to a sensible max.
  const wrapperClass = size === "large" ? "w-full max-w-[140px]" : "w-full max-w-[88px]";

  return (
    <div
      className={cn(
        "nouri-card flex flex-col items-center justify-center gap-2",
        size === "large" ? "py-5 px-4" : "py-3 px-2"
      )}
    >
      <div className={cn("relative aspect-square", wrapperClass)}>
        <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx={VB / 2}
            cy={VB / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeOpacity={0.6}
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={VB / 2}
            cy={VB / 2}
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
              <span
                className={cn(
                  "font-mono-data leading-none text-foreground tabular-nums",
                  size === "large" ? "text-2xl font-semibold" : "text-sm font-medium"
                )}
              >
                {Math.round(current)}
              </span>
              <span className={cn("text-muted-foreground mt-0.5", size === "large" ? "text-[10px]" : "text-[9px]")}>
                /{Math.round(goal)}
              </span>
            </>
          ) : (
            <>
              <span className={cn("text-muted-foreground", size === "large" ? "text-base" : "text-xs")}>—</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{meta.unit}</span>
            </>
          )}
        </div>
      </div>
      <div className="nouri-label text-center">
        {meta.label}
      </div>
    </div>
  );
}
