import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NutritionistInteractivePromptDecision } from "@/lib/nutri-ai/nutrition-rule-types";
import type { NutriAICoachMessage } from "@/lib/nutri-ai-coach";

interface CoachPromptDialogProps {
  open: boolean;
  message: NutriAICoachMessage;
  prompt: NutritionistInteractivePromptDecision;
  onOpenChange: (open: boolean) => void;
  onOptionSelect: (optionId: string) => void;
}

function accentClasses(accent: NutriAICoachMessage["accent"]) {
  switch (accent) {
    case "good":
      return {
        ring: "border-emerald-200",
        badge: "bg-emerald-100 text-emerald-700",
      };
    case "caution":
      return {
        ring: "border-amber-200",
        badge: "bg-amber-100 text-amber-700",
      };
    case "bad":
      return {
        ring: "border-rose-200",
        badge: "bg-rose-100 text-rose-700",
      };
    default:
      return {
        ring: "border-primary/20",
        badge: "bg-primary/10 text-primary",
      };
  }
}

export function CoachPromptDialog({
  open,
  message,
  prompt,
  onOpenChange,
  onOptionSelect,
}: CoachPromptDialogProps) {
  const accent = accentClasses(message.accent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-sm rounded-[28px] border p-0 overflow-hidden ${accent.ring}`}>
        <div className="bg-background p-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xl" aria-hidden>
                {message.emoji}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${accent.badge}`}>
                  {message.mealWindow}
                </span>
                <DialogTitle className="mt-2 text-base">{prompt.title}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-foreground/80">
              {prompt.question}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded-[22px] border border-border bg-muted/30 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Why Nutri AI asked</div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/85">{prompt.detail}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {prompt.options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onOptionSelect(option.id)}
                className={`rounded-full px-4 py-3 text-sm font-medium transition-colors ${
                  index === 0
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
