import { useEffect } from "react";
import { TRAINING_OPTIONS, type TrainingType } from "@/lib/nouri-training";

interface TrainingSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: TrainingType) => void;
}

export function TrainingSheet({ open, onClose, onPick }: TrainingSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(20, 30, 24, 0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Log training"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom"
        style={{ backgroundColor: "#FBF8F1", border: "1px solid #E2D8C4" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>
        <h3 className="font-serif text-xl font-medium text-center" style={{ color: "#1F3A28" }}>
          What did you do today?
        </h3>
        <p className="text-xs text-center text-muted-foreground mt-1">
          Adds +20g protein to today's target.
        </p>
        <div className="mt-4 space-y-2">
          {TRAINING_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => onPick(opt.type)}
              className="w-full flex items-center gap-3 rounded-2xl p-3 transition-transform active:scale-[0.99]"
              style={{ backgroundColor: "#F2EADB", border: "1px solid #E2D8C4" }}
            >
              <span className="text-2xl shrink-0" aria-hidden>
                {opt.emoji}
              </span>
              <span className="text-sm font-medium" style={{ color: "#1F3A28" }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 rounded-full py-3 text-sm font-medium border"
          style={{ borderColor: "#E2D8C4", color: "#5A4422" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
