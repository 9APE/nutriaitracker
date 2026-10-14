import { useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/renderMarkdown";
import { Sparkles, ThumbsDown, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { NutriAICoachMessage } from "@/lib/nutri-ai-coach";
import type { CoachFeedbackReason } from "@/lib/nutri-ai/nutrition-rule-types";
import { saveCoachTone, type CoachTone } from "@/lib/nutri-ai-coach-state";

interface CoachCardProps {
  message: NutriAICoachMessage;
  onDismiss: () => void;
  onNotHelpful?: (reason: CoachFeedbackReason) => void;
  onPrimaryAction?: () => void;
}

function accentStyles(accent: NutriAICoachMessage["accent"]) {
  switch (accent) {
    case "good":
      return {
        bg: "hsl(142 55% 95%)",
        border: "hsl(142 45% 78%)",
        fg: "hsl(142 70% 30%)",
        badge: "hsl(142 70% 42%)",
      };
    case "caution":
      return {
        bg: "hsl(38 100% 96%)",
        border: "hsl(38 80% 78%)",
        fg: "hsl(32 60% 30%)",
        badge: "hsl(38 92% 50%)",
      };
    case "bad":
      return {
        bg: "hsl(var(--destructive) / 0.10)",
        border: "hsl(var(--destructive) / 0.30)",
        fg: "hsl(var(--destructive))",
        badge: "hsl(var(--destructive))",
      };
    default:
      return {
        bg: "hsl(var(--primary) / 0.08)",
        border: "hsl(var(--primary) / 0.25)",
        fg: "hsl(var(--primary))",
        badge: "hsl(var(--primary))",
      };
  }
}

function colourPill(colour: NutriAICoachMessage["mainColour"]) {
  switch (colour) {
    case "GREEN":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "ORANGE":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "RED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const TONE_OPTIONS: Array<{ value: CoachTone; label: string }> = [
  { value: "supportive", label: "Supportive" },
  { value: "balanced", label: "Balanced" },
  { value: "direct", label: "Direct" },
  { value: "motivational", label: "Motivational" },
  { value: "scientific", label: "Scientific" },
];

const TONE_DESCRIPTIONS: Record<CoachTone, { eyebrow: string; copy: string }> = {
  supportive: {
    eyebrow: "Gentle coach",
    copy: "Softer encouragement, steadier reassurance, and less pressure in the wording.",
  },
  balanced: {
    eyebrow: "Default coach",
    copy: "Clear guidance with calm accountability and practical next steps.",
  },
  direct: {
    eyebrow: "Sharper coach",
    copy: "Shorter, firmer wording that gets to the point quickly.",
  },
  motivational: {
    eyebrow: "Momentum coach",
    copy: "More energy, more celebration, and stronger momentum-focused nudges.",
  },
  scientific: {
    eyebrow: "Evidence coach",
    copy: "Calmer, evidence-style framing with observations and suggested interventions.",
  },
};

export function CoachCard({ message, onDismiss, onNotHelpful, onPrimaryAction }: CoachCardProps) {
  const styles = accentStyles(message.accent);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedTone, setSelectedTone] = useState<CoachTone>(message.coachTone);
  const feedbackOptions: Array<{ reason: CoachFeedbackReason; label: string }> = [
    { reason: "too_strict", label: "Too strict" },
    { reason: "too_generic", label: "Too generic" },
    { reason: "not_relevant", label: "Not relevant" },
  ];

  useEffect(() => {
    setSelectedTone(message.coachTone);
  }, [message.coachTone]);

  const toneDescription = TONE_DESCRIPTIONS[selectedTone];

  return (
    <section
      className={`rounded-[24px] border p-4 space-y-3 ${message.shouldPop ? "animate-[nouri-bubble-in_0.24s_ease]" : ""}`}
      style={{ backgroundColor: styles.bg, borderColor: styles.border }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: "hsl(var(--background))", color: styles.badge }}
          aria-hidden
        >
          {message.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: styles.badge }} />
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: styles.fg }}>
              Nutri AI coach
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: styles.fg }}>
              {message.mealWindow}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colourPill(message.mainColour)}`}>
              {message.mainColour}
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground mt-1">{message.title}</h2>
          <p className="text-sm leading-relaxed text-foreground/85 mt-1">{renderMarkdown(message.message)}</p>
          <div className="mt-3 inline-flex rounded-full border border-background/60 bg-background/75 p-1">
            {TONE_OPTIONS.map((tone) => {
              const active = selectedTone === tone.value;
              return (
                <button
                  key={tone.value}
                  type="button"
                  onClick={() => {
                    setSelectedTone(tone.value);
                    saveCoachTone(tone.value);
                  }}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-200"
                  style={{
                    backgroundColor: active ? styles.badge : "transparent",
                    color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    transform: active ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {tone.label}
                </button>
              );
            })}
          </div>
          <div
            key={selectedTone}
            className="mt-2 rounded-2xl border border-background/60 bg-background/65 px-3 py-2 animate-[nouri-bubble-in_0.18s_ease]"
          >
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: styles.fg }}>
              {toneDescription.eyebrow}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/75">
              {toneDescription.copy}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-full hover:bg-background/70 transition-colors"
          aria-label="Dismiss coach"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="pl-[56px] space-y-3">
        {message.priorityNutrients.length > 0 && (
          <div className="space-y-2">
            {message.priorityNutrients.map((item) => (
              <div key={item.nutrientId} className="rounded-2xl border border-background/60 bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colourPill(item.colour)}`}>
                    {item.colour}
                  </span>
                </div>
                <p className="text-xs text-foreground/80 mt-1">{item.reason}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.suggestedAction}</p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-background/60 bg-background/70 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Next best action</div>
          <p className="text-sm text-foreground mt-1">{renderMarkdown(message.nextBestAction)}</p>
        </div>

        <Accordion type="single" collapsible className="rounded-2xl border border-background/60 bg-background/70 px-3">
          <AccordionItem value="why" className="border-none">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">Why?</AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="space-y-2">
                {message.why.map((line, index) => (
                  <p key={`${line}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
                    {renderMarkdown(line)}
                  </p>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-full px-3.5 py-2 text-xs font-medium text-primary-foreground"
            style={{ backgroundColor: styles.badge }}
          >
            {message.cta}
          </button>
          <button
            type="button"
            onClick={() => setFeedbackOpen((open) => !open)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ThumbsDown size={13} />
            Not helpful
          </button>
        </div>
        {feedbackOpen && (
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map((option) => (
              <button
                key={option.reason}
                type="button"
                onClick={() => onNotHelpful?.(option.reason)}
                className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
