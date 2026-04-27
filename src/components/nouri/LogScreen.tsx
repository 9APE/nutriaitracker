import { useEffect, useState } from "react";
import { Mic, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "@/hooks/useVoice";
import { analyzeMeal } from "@/lib/nouri-api";
import type { Meal } from "@/lib/nouri-storage";
import { AnalyzedMealSheet } from "./AnalyzedMealSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const examples = [
  "This morning I had 100g of oats with 200ml of whole milk, one banana, and a tablespoon of honey",
  "For lunch I had 150g of grilled chicken breast, 80g of white rice, half an avocado, and a drizzle of olive oil",
  "Dinner was 200g of salmon fillet, 150g of sweet potato, and a large side salad with balsamic vinegar",
  "Snack: 200g of Greek yoghurt, a handful of mixed berries, and 30g of granola",
];

interface LogScreenProps {
  onLogged: (m: Meal) => void;
}

export function LogScreen({ onLogged }: LogScreenProps) {
  const voice = useVoice();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<Omit<Meal, "id" | "created_at"> | null>(null);

  // Live mirror voice transcript into the textarea
  useEffect(() => {
    if (voice.listening && voice.transcript) {
      setText(voice.transcript);
    }
  }, [voice.transcript, voice.listening]);

  const handleAnalyze = async (input?: string) => {
    const payload = (input ?? text).trim();
    if (!payload) {
      toast.error("Describe your meal first");
      return;
    }
    setAnalyzing(true);
    try {
      const meal = await analyzeMeal(payload);
      setAnalyzed(meal);
    } catch (e: any) {
      toast.error(e?.message || "Could not analyze meal");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMicTap = async () => {
    if (voice.listening) {
      voice.stop();
      // small delay to let final transcript settle
      setTimeout(() => {
        const finalText = (voice.transcript || text).trim();
        if (finalText) handleAnalyze(finalText);
      }, 300);
    } else {
      voice.reset();
      setText("");
      await voice.start();
    }
  };

  const confirmMeal = () => {
    if (!analyzed) return;
    const meal: Meal = {
      ...analyzed,
      id: crypto.randomUUID(),
      created_at: Date.now(),
    };
    onLogged(meal);
    setAnalyzed(null);
    setText("");
    voice.reset();
    toast.success(`Logged ${meal.meal_name}`);
  };

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium">Log a Meal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Be specific for accurate macros. Include weights and quantities when you can.
        </p>
      </div>

      <div className="flex flex-col items-center my-8">
        <div className="relative">
          {voice.listening && (
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-mic-pulse" />
          )}
          <button
            onClick={handleMicTap}
            disabled={analyzing}
            aria-label={voice.listening ? "Stop recording" : "Start recording"}
            className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-card",
              voice.listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
            )}
          >
            <Mic size={36} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {voice.listening ? "Tap again to stop" : voice.supported ? "Tap to start recording" : "Voice not supported — type below"}
        </p>
      </div>

      {(voice.listening || voice.transcript) && (
        <div
          className={cn(
            "nouri-card p-4 mb-4 transition-colors",
            voice.listening && "border-primary"
          )}
        >
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {voice.listening ? "Listening…" : "Transcript"}
          </div>
          <p className="text-sm leading-relaxed text-foreground min-h-[1.5em]">
            {voice.transcript || "…"}
          </p>
        </div>
      )}

      {voice.error && (
        <div className="text-xs text-destructive mb-4 text-center">{voice.error}</div>
      )}

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or type instead</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. This morning I had 100g of rice, 150g of grilled chicken breast, one tablespoon of olive oil, and two handfuls of spinach"
        className="min-h-[110px] text-[15px] leading-relaxed bg-surface"
      />

      <Button
        onClick={() => handleAnalyze()}
        disabled={analyzing || !text.trim()}
        className="w-full h-12 mt-3 text-base"
      >
        {analyzing ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={18} />
            Nouri is calculating your macros…
          </>
        ) : (
          <>
            Analyse meal <Send size={16} className="ml-2" />
          </>
        )}
      </Button>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Try an example
        </p>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              className="w-full text-left text-sm leading-relaxed nouri-card p-3 hover:border-primary/50 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {analyzed && (
        <AnalyzedMealSheet
          meal={analyzed}
          onRetry={() => setAnalyzed(null)}
          onConfirm={confirmMeal}
        />
      )}
    </div>
  );
}
