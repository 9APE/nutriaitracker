import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, Loader2, Pencil } from "lucide-react";
import type { Meal, MealMicros } from "@/lib/nouri-storage";

interface AnalyzedMealSheetProps {
  /** The analyzed meal. `null` while the AI is still working. */
  meal:
    | (Omit<Meal, "id" | "created_at"> & {
        tip?: string;
        /** 01 confidence the AI has in its estimate. */
        confidence?: number;
        /** Human-readable list of fields the AI couldn't determine, e.g. ["portion size"]. */
        missingFields?: string[];
      })
    | null;
  /** True while we're waiting for the AI job to complete. */
  loading?: boolean;
  /** Non-null when the job failed; message is shown inline with a retry. */
  error?: string | null;
  onRetry: () => void;
  onConfirm: () => void;
}

type ConfidenceLevel = "high" | "medium" | "low";

function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

const CONFIDENCE_COPY: Record<ConfidenceLevel, { label: string; Icon: typeof CheckCircle2 }> = {
  high:   { label: "Looks accurate",    Icon: CheckCircle2 },
  medium: { label: "May need review",   Icon: Info },
  low:    { label: "Likely inaccurate", Icon: AlertTriangle },
};

// Tailwind classes per level  kept here so the rest of the JSX stays readable.
// Uses semantic colors where available; falls back to amber/red/emerald which
// already exist in the project palette for status messaging.
const CONFIDENCE_CLASSES: Record<ConfidenceLevel, string> = {
  high:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  low:    "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
};


const MICRO_META: { key: keyof MealMicros; label: string; unit: string }[] = [
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "saturated_fat", label: "Sat. Fat", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
  { key: "calcium", label: "Calcium", unit: "mg" },
  { key: "iron", label: "Iron", unit: "mg" },
  { key: "vitamin_c", label: "Vit C", unit: "mg" },
  { key: "vitamin_a", label: "Vit A", unit: "g" },
  { key: "vitamin_d", label: "Vit D", unit: "g" },
];

export function AnalyzedMealSheet({ meal, loading, error, onRetry, onConfirm }: AnalyzedMealSheetProps) {
  const micros = meal?.micros ?? {};
  const microRows = MICRO_META.filter((m) => typeof micros[m.key] === "number");
  const isLoading = !!loading && !meal && !error;
  const isError = !!error;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onRetry} />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up flex flex-col max-h-[90vh]">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        <div className="overflow-y-auto px-6 pt-3 pb-4">
          {/* Header */}
          <div className="mb-4">
            {isLoading ? (
              <>
                <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-muted/60 animate-pulse mt-2" />
              </>
            ) : meal ? (
              <>
                <h3 className="font-serif text-xl font-medium leading-tight">{meal.meal_name}</h3>
                <p className="text-sm text-muted-foreground">{meal.type}  {meal.date}</p>
              </>
            ) : null}
          </div>

          {/* Confidence pill + missing fields + edit hint.
              Shown only when the AI returned a confidence score. Compact one-row
              pill with optional missingFields chip line below  keeps the sheet
              uncluttered. */}
          {meal && typeof meal.confidence === "number" && (
            <ConfidenceBanner
              confidence={meal.confidence}
              missingFields={meal.missingFields}
            />
          )}

          {/* Error state */}
          {isError && (
            <div
              className="rounded-2xl px-4 py-3 text-sm leading-relaxed flex items-start gap-2 mb-2"
              style={{
                backgroundColor: "hsl(var(--tone-warning-bg, var(--muted)))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Macros */}
          {!isError && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {isLoading ? (
                <>
                  <ChipSkeleton /><ChipSkeleton /><ChipSkeleton /><ChipSkeleton />
                </>
              ) : meal ? (
                <>
                  <Chip label="Calories" value={`${meal.calories}`} unit="kcal" tone="calories" />
                  <Chip label="Protein" value={`${meal.protein}`} unit="g" tone="protein" />
                  <Chip label="Carbs" value={`${meal.carbs}`} unit="g" tone="carbs" />
                  <Chip label="Fat" value={`${meal.fat}`} unit="g" tone="fat" />
                </>
              ) : null}
            </div>
          )}

          {/* Micros */}
          {meal && microRows.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Micronutrients
              </div>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {microRows.map((m) => (
                  <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-foreground">{m.label}</span>
                    <span className="font-mono-data text-sm text-foreground">
                      {Math.round((micros[m.key] as number) * 10) / 10}
                      <span className="text-xs text-muted-foreground ml-1">{m.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI feedback */}
          {meal?.tip && (
            <div
              className="rounded-2xl px-4 py-3 text-sm leading-relaxed flex items-start gap-2"
              style={{
                backgroundColor: "hsl(var(--tone-success-bg))",
                border: "1px solid hsl(var(--tone-success-border))",
                color: "hsl(var(--tone-success-fg))",
              }}
            >
              <span className="flex-1">{meal.tip}</span>
            </div>
          )}

          {/* Loading hint */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Estimating nutrients
            </div>
          )}
        </div>

        {/* Sticky actions */}
        <div
          className="px-6 pt-3 border-t border-border bg-surface flex gap-3 shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          <Button variant="outline" className="flex-1 h-12" onClick={onRetry}>
            {isError ? "Close" : "Try again"}
          </Button>
          <Button className="flex-1 h-12" onClick={onConfirm} disabled={!meal || isError}>
            Log it
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label, value, unit, tone,
}: { label: string; value: string; unit: string; tone: "calories" | "protein" | "carbs" | "fat" }) {
  const toneClass = {
    calories: "border-macro-calories/30 bg-primary-soft",
    protein: "border-macro-protein/30 bg-macro-protein/10",
    carbs: "border-macro-carbs/30 bg-macro-carbs/10",
    fat: "border-macro-fat/30 bg-macro-fat/10",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono-data text-lg text-foreground">
        {value}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function ChipSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="h-3 w-12 rounded bg-muted animate-pulse" />
      <div className="h-5 w-16 rounded bg-muted/60 animate-pulse mt-2" />
    </div>
  );
}

function ConfidenceBanner({
  confidence,
  missingFields,
}: {
  confidence: number;
  missingFields?: string[];
}) {
  const level = classifyConfidence(confidence);
  const { label, Icon } = CONFIDENCE_COPY[level];
  const cls = CONFIDENCE_CLASSES[level];
  const pct = Math.round(confidence * 100);
  const missing = (missingFields ?? []).filter(Boolean);

  return (
    <div className="mb-4 space-y-2">
      {/* Single-row pill: icon  label  percentage. */}
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${cls}`}>
        <Icon size={14} className="shrink-0" />
        <span className="flex-1">{label}</span>
        <span className="font-mono-data opacity-80">{pct}%</span>
      </div>

      {/* Missing-fields chips  only when present. */}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((field) => (
            <span
              key={field}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              <Info size={10} />
              Missing {field}
            </span>
          ))}
        </div>
      )}

      {/* Subtle nudge  one line, muted. */}
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <Pencil size={10} />
        You can edit values before saving
      </p>
    </div>
  );
}
