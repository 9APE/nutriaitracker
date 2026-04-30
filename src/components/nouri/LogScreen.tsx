import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Send, Square, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "@/hooks/useVoice";
import { analyzeMeal } from "@/lib/nouri-api";
import type { Meal } from "@/lib/nouri-storage";
import { recordMealLogged } from "@/lib/nouri-streak";
import { AnalyzedMealSheet } from "./AnalyzedMealSheet";
import { BarcodeScanner } from "./BarcodeScanner";
import { BarcodeProductSheet } from "./BarcodeProductSheet";
import { PhotoLabelSheet } from "./PhotoLabelSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage, t } from "@/lib/nouri-i18n";

const examples = [
  "This morning I had 100g of oats with 200ml of whole milk, one banana, and a tablespoon of honey",
  "For lunch I had 150g of grilled chicken breast, 80g of white rice, half an avocado, and a drizzle of olive oil",
  "Dinner was 200g of salmon fillet, 150g of sweet potato, and a large side salad with balsamic vinegar",
  "Snack: 200g of Greek yoghurt, a handful of mixed berries, and 30g of granola",
];

interface LogScreenProps {
  onLogged: (m: Meal) => void;
  prefillText?: string;
  onPrefillConsumed?: () => void;
}

type ChatMsg =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      pending?: boolean;
      options?: string[];
      optionsConsumed?: boolean;
    };

const uid = () => crypto.randomUUID();

async function analyzeWithRetry(
  text: string,
  attempts = 2,
  opts?: { alreadyClarified?: boolean }
): Promise<Awaited<ReturnType<typeof analyzeMeal>>> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await analyzeMeal(text, opts);
    } catch (e) {
      lastErr = e;
      // brief backoff before retry
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr;
}

export function LogScreen({ onLogged, prefillText, onPrefillConsumed }: LogScreenProps) {
  const lang = useLanguage();
  const voice = useVoice();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<Omit<Meal, "id" | "created_at"> | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [pendingClarify, setPendingClarify] = useState<{ original: string; messageId: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [photoCapture, setPhotoCapture] = useState<{ file: File; barcode: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, analyzing, voice.transcribing]);

  useEffect(() => {
    if (prefillText) {
      setText(prefillText);
      onPrefillConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillText]);

  const pushAssistant = (text: string, pending = false) => {
    const id = uid();
    setChat((c) => [...c, { id, role: "assistant", text, pending }]);
    return id;
  };
  const updateAssistant = (id: string, text: string, pending = false) => {
    setChat((c) => c.map((m) => (m.id === id ? { ...m, text, pending } : m)));
  };

  const consumeOptions = (id: string) => {
    setChat((c) => c.map((m) => (m.id === id && m.role === "assistant" ? { ...m, optionsConsumed: true } : m)));
  };

  const runAnalyze = async (
    input: string,
    opts?: { alreadyClarified?: boolean; originalForClarify?: string }
  ) => {
    const payload = input.trim();
    if (!payload) {
      pushAssistant(t("didntCatchThat", lang));
      return;
    }

    setChat((c) => [...c, { id: uid(), role: "user", text: payload }]);
    const thinkingId = pushAssistant(t("thinking", lang), true);

    setAnalyzing(true);
    try {
      const result = await analyzeWithRetry(payload, 2, { alreadyClarified: opts?.alreadyClarified });

      if (result.kind === "clarification") {
        const { question, options } = result.clarification;
        setChat((c) =>
          c.map((m) =>
            m.id === thinkingId && m.role === "assistant"
              ? { ...m, text: question, pending: false, options }
              : m
          )
        );
        setPendingClarify({ original: payload, messageId: thinkingId });
      } else {
        const meal = result.meal;
        updateAssistant(
          thinkingId,
          `${t("gotItPrefix", lang)} — **${meal.meal_name}** (${meal.type}). ~ **${meal.calories} ${t("kcalShort", lang)}**, ${meal.protein}${t("gShort", lang)} ${t("protein", lang)}, ${meal.carbs}${t("gShort", lang)} ${t("carbs", lang)}, ${meal.fat}${t("gShort", lang)} ${t("fat", lang)}. ${t("tapLogIt", lang)}`,
          false
        );
        setAnalyzed(meal);
        setPendingClarify(null);
      }
    } catch (e: any) {
      updateAssistant(
        thinkingId,
        t("couldntAnalyse", lang, { err: e?.message || "unknown error" }),
        false
      );
      toast.error(e?.message || t("couldntAnalyse", lang, { err: "" }));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClarifyAnswer = async (answer: string) => {
    if (!pendingClarify) return;
    const { original, messageId } = pendingClarify;
    consumeOptions(messageId);
    setPendingClarify(null);
    const combined = `${original} — ${answer}`;
    await runAnalyze(combined, { alreadyClarified: true });
  };

  const handleMicTap = async () => {
    if (voice.listening) {
      const finalText = await voice.stop();
      setText("");
      // Always respond, even if empty
      await runAnalyze(finalText || "");
    } else {
      voice.reset();
      setText("");
      await voice.start();
    }
  };

  const handleSubmitText = async () => {
    const tx = text.trim();
    if (!tx) {
      toast.error(t("describeMealFirst", lang));
      return;
    }
    setText("");
    if (pendingClarify) {
      await handleClarifyAnswer(tx);
    } else {
      await runAnalyze(tx);
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
    recordMealLogged();
    setAnalyzed(null);
    pushAssistant(`${t("logged", lang)} **${meal.meal_name}** — ${t("anythingElse", lang)}`);
    voice.reset();
    toast.success(t("loggedToast", lang, { name: meal.meal_name }));
  };

  const busy = analyzing || voice.transcribing;

  return (
    <div className="px-5 pt-4 pb-28 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium">{t("logMealTitle", lang)}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("logMealHelp", lang)}
        </p>
      </div>

      <div className="flex flex-col items-center my-6">
        <div className="relative">
          {voice.listening && (
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-mic-pulse" />
          )}
          <button
            onClick={handleMicTap}
            disabled={analyzing || voice.transcribing}
            aria-label={voice.listening ? t("stopRecording", lang) : t("startRecording", lang)}
            className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-card",
              voice.listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
              (analyzing || voice.transcribing) && "opacity-60"
            )}
          >
            {voice.transcribing ? (
              <Loader2 size={36} className="animate-spin" />
            ) : voice.listening ? (
              <Square size={32} />
            ) : (
              <Mic size={36} />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4 min-h-[1em]">
          {voice.listening
            ? t("recordingTap", lang)
            : voice.transcribing
            ? t("transcribingAudio", lang)
            : voice.supported
            ? t("tapToRecord", lang)
            : t("voiceUnsupported", lang)}
        </p>

        <button
          onClick={() => setScannerOpen(true)}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card hover:border-primary/40 hover:text-foreground px-4 py-2 text-sm text-muted-foreground transition-colors disabled:opacity-60"
        >
          <ScanLine size={16} />
          Scan Barcode
        </button>
      </div>

      {voice.error && (
        <div className="text-xs text-destructive mb-4 text-center">{voice.error}</div>
      )}

      {chat.length > 0 && (
        <div className="space-y-2 mb-4">
          {chat.map((m) => (
            <div key={m.id}>
              <div
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-surface border border-border text-foreground rounded-bl-sm"
                  )}
                >
                  {m.role === "assistant" && m.pending ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      {m.text}
                    </span>
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: renderInline(m.text) }} />
                  )}
                </div>
              </div>
              {m.role === "assistant" &&
                m.options &&
                m.options.length > 0 &&
                !m.optionsConsumed && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-1">
                    {m.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleClarifyAnswer(opt)}
                        disabled={analyzing}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{t("orTypeInstead", lang)}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("logExamplePlaceholder", lang)}
        className="min-h-[90px] text-[15px] leading-relaxed bg-surface"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmitText();
          }
        }}
      />

      <Button
        onClick={handleSubmitText}
        disabled={busy || !text.trim()}
        className="w-full h-12 mt-3 text-base"
      >
        {analyzing ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={18} />
            {t("calculatingMacros", lang)}
          </>
        ) : (
          <>
            {t("send", lang)} <Send size={16} className="ml-2" />
          </>
        )}
      </Button>

      {chat.length === 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            {t("tryAnExample", lang)}
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
      )}

      {analyzed && (
        <AnalyzedMealSheet
          meal={analyzed}
          onRetry={() => setAnalyzed(null)}
          onConfirm={confirmMeal}
        />
      )}

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => {
            setScannerOpen(false);
            setScannedBarcode(code);
          }}
          onPhotoCaptured={(file) => {
            setScannerOpen(false);
            // No barcode was read — synthesize a stable local key so future
            // photo-added entries don't collide.
            const localBarcode = `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
            setPhotoCapture({ file, barcode: localBarcode });
          }}
        />
      )}

      {scannedBarcode && (
        <BarcodeProductSheet
          barcode={scannedBarcode}
          onClose={() => setScannedBarcode(null)}
          onMealReady={(draft) => {
            setScannedBarcode(null);
            setAnalyzed(draft);
          }}
        />
      )}

      {photoCapture && (
        <PhotoLabelSheet
          file={photoCapture.file}
          barcode={photoCapture.barcode}
          onClose={() => setPhotoCapture(null)}
          onMealReady={(draft) => {
            setPhotoCapture(null);
            setAnalyzed(draft);
          }}
        />
      )}
    </div>
  );
}

// minimal **bold** -> <strong>
function renderInline(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
