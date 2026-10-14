import { useEffect, useState } from "react";
import { TRAINING_OPTIONS, TRAINING_BURN, type TrainingType } from "@/lib/nouri-training";
import { Flame } from "lucide-react";

interface TrainingSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: TrainingType, calories?: number) => void;
}

export function TrainingSheet({ open, onClose, onPick }: TrainingSheetProps) {
  const [selected, setSelected] = useState<TrainingType | null>(null);
  const [calories, setCalories] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setCalories("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!selected) return;
    const cal = calories.trim() ? Math.max(0, parseInt(calories, 10) || 0) : undefined;
    onPick(selected, cal);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Log training"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom border bg-card text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>
        <h3 className="font-serif text-xl font-medium text-center text-foreground">
          What did you do today?
        </h3>
        <p className="text-xs text-center text-muted-foreground mt-1">
          Adds +20g protein and your burned calories to today.
        </p>

        <div className="mt-4 space-y-2">
          {TRAINING_OPTIONS.map((opt) => {
            const isSel = selected === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setSelected(opt.type)}
                className={`w-full flex items-center justify-between gap-3 rounded-2xl p-3 border transition-colors active:scale-[0.99] ${
                  isSel
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  ~{TRAINING_BURN[opt.type]} kcal
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Flame size={14} className="text-primary" />
              Calories burned (optional)
            </label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={calories}
              onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={`Default ~${TRAINING_BURN[selected]} kcal`}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono-data"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full py-3 text-sm font-medium border border-border text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!selected}
            className="rounded-full py-3 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-40"
          >
            Log training
          </button>
        </div>
      </div>
    </div>
  );
}
