/**
 * VoiceLogFab — full-screen ChatGPT-style voice capture for meal logging.
 *
 * Shows an immersive orb that breathes with the mic input. Tap to stop and
 * transcribe + analyze the meal. Skips the chat surface entirely.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";
import { analyzeMeal, type AnalyzedMeal } from "@/lib/nouri-api";
import { AnalyzedMealSheet } from "./AnalyzedMealSheet";
import { recordMealLogged } from "@/lib/nouri-streak";
import type { Meal, MealType } from "@/lib/nouri-storage";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

interface Props {
  onAddMeal: (m: Meal) => Promise<void> | void;
  autoStart?: boolean;
  onClose?: () => void;
}

export function VoiceLogFab({ onAddMeal, autoStart = false, onClose }: Props) {
  const voice = useVoice();
  const [analyzing, setAnalyzing] = useState(false);
  const [meal, setMeal] = useState<AnalyzedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    voice.reset();
    haptic("light");
    void voice.start();
  }, [autoStart, voice]);

  useEffect(() => {
    if (!voice.listening) return;
    const stream = voice.getStream();
    if (!stream) return;
    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const lvl = Math.min(1, rms * 3.2);
      setLevel((prev) => prev * 0.6 + lvl * 0.4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      try { src.disconnect(); } catch {}
      void ctx.close();
    };
  }, [voice.listening, voice]);

  const handleStop = async () => {
    haptic("medium");
    const text = await voice.stop();
    if (!text) {
      toast.error("Couldn't hear that — try again.");
      onClose?.();
      return;
    }
    setOpen(true);
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeMeal(text);
      if (result.kind === "meal") {
        setMeal(result.meal);
      } else {
        setError("Couldn't auto-log — try the chat for clarifying questions.");
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't analyze meal");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setMeal(null);
    setError(null);
    onClose?.();
  };

  const handleCancel = async () => {
    haptic("light");
    if (voice.listening) {
      try { await voice.stop(); } catch {}
    }
    onClose?.();
  };

  const baseSize = 180;
  const reactive = level * 140;
  const size = baseSize + reactive;
  const glow = 60 + level * 80;

  const status = voice.transcribing
    ? "Transcribing…"
    : analyzing
      ? "Analyzing your meal…"
      : voice.listening
        ? "Listening… tap to send"
        : "Tap mic to talk";

  const showFullscreen = !open && (voice.listening || voice.transcribing || analyzing);

  return (
    <>
      {showFullscreen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden animate-fade-in"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary) / 0.18), hsl(var(--background)) 55%, hsl(var(--background)))",
          }}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.35),transparent_70%)] blur-3xl animate-[nouri-float-a_14s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.28),transparent_70%)] blur-3xl animate-[nouri-float-b_18s_ease-in-out_infinite]" />
            <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.30),transparent_70%)] blur-3xl animate-[nouri-float-c_16s_ease-in-out_infinite]" />
          </div>

          <div className="w-full flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
            <button
              onClick={handleCancel}
              aria-label="Close"
              className="grid h-10 w-10 place-items-center rounded-full border border-border/50 bg-card/70 text-foreground backdrop-blur-xl transition-transform active:scale-95"
            >
              <X size={20} />
            </button>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Nutri AI Voice
            </div>
            <div className="w-10" />
          </div>

          <div className="relative grid w-full flex-1 place-items-center">
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: size + 80,
                height: size + 80,
                background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)",
                opacity: 0.5 + level * 0.5,
                transition: "width 120ms ease-out, height 120ms ease-out, opacity 120ms ease-out",
              }}
            />
            <div
              className="relative rounded-full"
              style={{
                width: size,
                height: size,
                background:
                  "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.55) 55%, hsl(var(--primary) / 0.25) 100%)",
                boxShadow: `0 0 ${glow}px hsl(var(--primary) / 0.55), inset 0 0 60px hsl(var(--primary) / 0.4)`,
                transition: "width 90ms ease-out, height 90ms ease-out, box-shadow 120ms ease-out",
              }}
            >
              <div
                className="absolute inset-3 rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 55%)",
                  mixBlendMode: "overlay",
                }}
              />
              <div
                className="absolute inset-0 rounded-full animate-[nouri-float-a_5s_ease-in-out_infinite]"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 60%)",
                  filter: "blur(20px)",
                }}
              />
            </div>

            <div className="absolute bottom-8 px-6 text-center">
              <p className="text-base font-medium text-foreground">{status}</p>
              {voice.error && (
                <p className="mt-1 text-xs text-destructive">{voice.error}</p>
              )}
            </div>
          </div>

          <div className="flex w-full items-center justify-center pb-[calc(env(safe-area-inset-bottom)+32px)]">
            <button
              onClick={voice.listening ? handleStop : undefined}
              disabled={!voice.listening}
              aria-label={voice.listening ? "Stop and send" : "Working"}
              className={`grid h-20 w-20 place-items-center rounded-full shadow-2xl transition-all active:scale-95 ${
                voice.listening
                  ? "bg-primary text-primary-foreground hover:scale-105"
                  : "bg-card/80 text-muted-foreground"
              }`}
              style={{
                boxShadow: voice.listening
                  ? `0 0 40px hsl(var(--primary) / 0.55)`
                  : undefined,
              }}
            >
              {voice.transcribing || analyzing ? (
                <Loader2 size={28} className="animate-spin" />
              ) : voice.listening ? (
                <Square size={26} />
              ) : (
                <Mic size={26} />
              )}
            </button>
          </div>
        </div>
      )}

      {open && (
        <AnalyzedMealSheet
          meal={meal}
          loading={analyzing}
          error={error}
          onRetry={reset}
          onConfirm={async () => {
            if (!meal) return;
            const m: Meal = {
              id: crypto.randomUUID(),
              meal_name: meal.meal_name,
              type: meal.type as MealType,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
              date: meal.date,
              created_at: Date.now(),
              micros: meal.micros,
            };
            await onAddMeal(m);
            recordMealLogged();
            haptic("success");
            toast.success(`Logged ${m.meal_name}`);
            reset();
          }}
        />
      )}
    </>
  );
}
