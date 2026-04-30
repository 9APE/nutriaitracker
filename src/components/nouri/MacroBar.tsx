import { cn } from "@/lib/utils";
import { useLanguage, t, type UIKey } from "@/lib/nouri-i18n";

interface MacroBarProps {
  label: string;
  emoji?: string;
  current: number;
  goal: number;
  color: "protein" | "carbs" | "fat" | "calories";
  unit?: string;
}

const colorMap = {
  protein: "bg-macro-protein",
  carbs: "bg-macro-carbs",
  fat: "bg-macro-fat",
  calories: "bg-macro-calories",
};

export function MacroBar({ label, emoji, current, goal, color, unit = "g" }: MacroBarProps) {
  const lang = useLanguage();
  const pct = Math.min(100, goal > 0 ? (current / goal) * 100 : 0);
  const lower = label.toLowerCase();
  const i18nKey: UIKey | null =
    lower === "protein" ? "protein" : lower === "carbs" ? "carbs" : lower === "fat" ? "fat" : null;
  const displayLabel = i18nKey ? t(i18nKey, lang) : label;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-foreground">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {displayLabel}
        </span>
        <span className="font-mono-data text-sm text-muted-foreground">
          <span className="text-foreground">{Math.round(current)}</span>
          <span className="mx-1">/</span>
          {Math.round(goal)}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full macro-fill", colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
