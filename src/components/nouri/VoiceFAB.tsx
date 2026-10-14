import { useState, useEffect } from "react";
import { Mic, X, StopCircle, Check } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVoice } from "@/hooks/useVoice";
import { analyzeMeal, type AnalyzedMeal } from "@/lib/nouri-api";
import { AnalyzedMealSheet } from "@/components/nouri/AnalyzedMealSheet";
import { recordMealLogged } from "@/lib/nouri-streak";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";

interface VoiceFABProps {
  goals: Goals;
  meals: Meal[];
  onAddMeal: (m: Meal) => Promise<void> | void;
}

type Phase = "idle" | "recording" | "transcribing" | "analyzing" | "preview" | "clarifying";

interface ClarifyState {
  question: string;
  options: string[];
  originalText: string;
}

export function VoiceFAB({ goals, meals, onAddMeal }: VoiceFABProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<AnalyzedMeal | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyState | null>(null);
  const voice = useVoice();

  const reset = () => {
    voice.reset();
    setPhase("idle");
    setOverlayOpen(false);
    setPendingMeal(null);
    setAnalyzeError(null);
    setClarify(null);
  };

  const runAnalyze = async (text: string, alreadyClarified = false) => {
    setPhase("analyzing");
    setAnalyzeError(null);
    try {
      const result = await analyzeMeal(text, {
        alreadyClarified,
        context: { goals, meals },
      });
      if (result.kind === "meal") {
        setPendingMeal(result.meal);
        setPhase("preview");
      } else {
        setClarify({
          question: result.clarification.question,
          options: result.clarification.options,
          originalText: text,
        });
        setPhase("clarifying");
      }
    } catch (e: any) {
      setAnalyzeError(e?.message || "Failed to analyze");
      setPhase("preview");
    }
  };

  const handleFABTap = async () => {
    if (phase !== "idle") return;
    setOverlayOpen(true);
    setPhase("recording");
    try {
      await voice.start();
    } catch {
      reset();
    }
  };

  const handleStop = async () => {
    setPhase("transcribing");
    const text = await voice.stop();
    if (!text?.trim()) {
      toast.error("No speech detected  try again.");
      reset();
      return;
    }
    if (clarify) {
      await runAnalyze(`${clarify.originalText}\n\nClarifying answer: ${text}`, true);
    } else {
      await runAnalyze(text);
    }
  };

  const handleRetry = async () => {
    voice.reset();
    setAnalyzeError(null);
    setPendingMeal(null);
    setClarify(null);
    setPhase("recording");
    try {
      await voice.start();
    } catch {
      reset();
    }
  };

  const handleClarifyRecord = async () => {
    setPhase("recording");
    voice.reset();
    try {
      await voice.start();
    } catch {
      reset();
    }
  };

  const handleConfirm = async () => {
    if (!pendingMeal) return;
    const meal: Meal = {
      ...pendingMeal,
      id: crypto.randomUUID(),
      date: pendingMeal.date ?? todayISO(),
      created_at: Date.now(),
    };
    try {
      await onAddMeal(meal);
      recordMealLogged();
      toast.success(`Logged ${meal.meal_name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to log meal");
    }
    reset();
  };

  const isBusy = phase === "transcribing" || phase === "analyzing";

  // Elapsed seconds while recording
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "recording") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  // FAB visual state
  const fabClasses =
    phase === "recording"
      ? "bg-destructive text-destructive-foreground"
      : isBusy
      ? "bg-muted text-muted-foreground"
      : "bg-primary text-primary-foreground";
  const fabLabel = phase === "recording" ? "REC" : isBusy ? "WAIT" : "LOG";
  const FabIcon = isBusy ? Loader2 : Mic;

  // Status pill (overlay header)
  type Pill = { spinner?: boolean; check?: boolean; dotClass?: string; textClass: string; label: string };
  const statusPill: Pill = (() => {
    switch (phase) {
      case "recording":
        return { dotClass: "bg-destructive animate-pulse", textClass: "text-destructive", label: "Listening  speak now" };
      case "transcribing":
        return { spinner: true, textClass: "text-amber-600 dark:text-amber-400", label: "Transcribing your speech" };
      case "analyzing":
        return { spinner: true, textClass: "text-amber-600 dark:text-amber-400", label: "Analyzing meal" };
      case "clarifying":
        return { dotClass: "bg-primary", textClass: "text-primary", label: "One more thing" };
      default:
        return { check: true, textClass: "text-foreground", label: "Review & confirm" };
    }
  })();

  return (
    <>
      {/* FAB button */}
      <button
        onClick={handleFABTap}
        disabled={phase !== "idle"}
        className={`fixed right-5 z-40 w-16 h-16 rounded-full shadow-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${fabClasses}`}
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
        aria-label="Log meal by voice"
      >
        {phase === "recording" && (
          <>
            <span className="absolute inset-0 rounded-full bg-destructive/30 animate-[nouri-pulse_1.5s_ease-in-out_infinite]" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive border-2 border-background z-10" />
          </>
        )}
        <FabIcon size={20} className={isBusy ? "animate-spin" : ""} />
        <span className="text-[9px] font-semibold tracking-wide leading-none relative z-10">{fabLabel}</span>
      </button>

      {/* Full-screen overlay */}
      {overlayOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-safe-top pt-4 pb-3 border-b border-border">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 ${statusPill.textClass}`}>
              {statusPill.spinner && <Loader2 size={14} className="animate-spin" />}
              {statusPill.dotClass && <span className={`w-2.5 h-2.5 rounded-full ${statusPill.dotClass}`} />}
              {statusPill.check && <Check size={14} />}
              <span className="text-xs font-semibold tracking-wide">{statusPill.label}</span>
            </div>
            <button
              onClick={reset}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Recording phase */}
            {phase === "recording" && (
              <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
                {/* Pulsing mic */}
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-28 h-28 rounded-full bg-destructive/20 animate-[nouri-pulse_1.5s_ease-in-out_infinite]" />
                  <span className="absolute w-20 h-20 rounded-full bg-destructive/30 animate-[nouri-pulse_1.5s_ease-in-out_0.3s_infinite]" />
                  <div className="relative w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg z-10">
                    <Mic size={28} className="text-destructive-foreground" />
                  </div>
                </div>

                {/* Elapsed counter */}
                <div className="flex items-center gap-2 text-destructive">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="font-mono text-sm font-semibold tabular-nums">{mmss}</span>
                </div>

                {/* Live transcript or hint */}
                <div className="text-center min-h-[3rem]">
                  <p className="text-base font-medium text-foreground leading-snug">
                    {voice.transcript || "Listening"}
                  </p>
                  {!voice.transcript && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Say what you ate  tap Stop when you're done
                    </p>
                  )}
                </div>

                {/* Stop button */}
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-medium text-sm shadow"
                >
                  <StopCircle size={18} />
                  Stop recording
                </button>
              </div>
            )}

            {/* Busy phases */}
            {isBusy && (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
                <Loader2 size={40} className="animate-spin text-amber-500" />
                <div>
                  <p className="text-base font-medium text-foreground">
                    {phase === "transcribing" ? "Transcribing your speech" : "Analyzing nutrition"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {phase === "transcribing" ? "Step 1 of 2" : "Step 2 of 2"}
                  </p>
                </div>
              </div>
            )}


            {/* Clarification phase */}
            {phase === "clarifying" && clarify && (
              <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
                <p className="text-base font-medium text-foreground">{clarify.question}</p>
                {clarify.options.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    {clarify.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => runAnalyze(`${clarify.originalText}\n\nClarifying answer: ${opt}`, true)}
                        className="px-4 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors text-left"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleClarifyRecord}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow"
                >
                  <Mic size={16} />
                  Answer by voice
                </button>
              </div>
            )}

            {/* Preview phase */}
            {phase === "preview" && (
              <div className="px-5 pt-4 pb-8">
                <AnalyzedMealSheet
                  meal={pendingMeal}
                  loading={false}
                  error={analyzeError}
                  onRetry={handleRetry}
                  onConfirm={handleConfirm}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
