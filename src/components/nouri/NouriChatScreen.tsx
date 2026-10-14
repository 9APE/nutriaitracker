/**
 * Unified Nouri chat combines meal logging and the nutrition Q&A assistant
 * into one surface. Messages persist in `chat_messages`; AI runs as
 * background `ai_jobs` so the user can navigate away while it's thinking.
 */
import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addWaterIntakeForDate, todayISO, type Goals, type Meal, type MealType } from "@/lib/nouri-storage";
import { toast } from "sonner";

import { useNouriChat } from "@/hooks/useNouriChat";
import { MessageList, MealJobBridge } from "./chat/MessageList";
import { MessageInput, type MessageInputHandle } from "./chat/MessageInput";


import { MealDetailSheet } from "./MealDetailSheet";
import { AnalyzedMealSheet } from "./AnalyzedMealSheet";
import { BarcodeScanner } from "./BarcodeScanner";
import { BarcodeProductSheet } from "./BarcodeProductSheet";
import { PhotoLabelSheet } from "./PhotoLabelSheet";

interface Props {
  goals: Goals;
  meals: Meal[];
  prefillText?: string;
  prefillSource?: "voice" | "text";
  prefillAutoSend?: boolean;
  onPrefillConsumed?: () => void;
  autoStartVoice?: boolean;
  onAutoVoiceConsumed?: () => void;
  onAddMeal: (m: Meal) => Promise<void> | void;
  onDeleteMeal: (id: string) => Promise<void> | void;
}

const WATER_DRINK_RE = /\b(plain water|water|mineral water|sparkling water)\b/i;
const SUGARY_DRINK_RE = /\b(sprite|fanta|coke|cola|soda|lemonade|sweet tea|juice drink|milkshake|energy drink)\b/i;


function inferredWaterMl(mealName: string): number {
  if (!WATER_DRINK_RE.test(mealName)) return 0;
  if (SUGARY_DRINK_RE.test(mealName)) return 0;
  return 250;
}

export function NouriChatScreen({
  goals,
  meals,
  prefillText,
  prefillSource,
  prefillAutoSend,
  onPrefillConsumed,
  autoStartVoice,
  onAutoVoiceConsumed,
  onAddMeal,
  onDeleteMeal,
}: Props) {
  const {
    user,
    rows,
    todayMeals,
    todaySoFar,
    pendingPreview,
    pendingClarification,
    setPendingPreview,
    getFreshProfile,
    send,
    resolveChatJob,
    resolveMealJob,
    clearConversation,
  } = useNouriChat({ goals, meals });

  const inputRef = useRef<MessageInputHandle>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [photoCapture, setPhotoCapture] = useState<{ file: File; barcode: string } | null>(null);
  const resumedClarificationAtRef = useRef<number | null>(null);

  const openMeal = meals.find((m) => m.id === openMealId) || null;
  const aiStatus = pendingPreview
    ? "Analyzing meal"
    : pendingClarification?.question
      ? "Needs detail"
      : rows.some((row) => row.active_job_id && !row.content)
        ? "In progress"
        : "Ready";
  

  useEffect(() => {
    if (!pendingClarification?.question) return;
    if (resumedClarificationAtRef.current === pendingClarification.askedAt) return;
    resumedClarificationAtRef.current = pendingClarification.askedAt;
    if (pendingClarification.source === "voice") {
      void inputRef.current?.startVoice();
      return;
    }
    inputRef.current?.focus();
  }, [pendingClarification]);

  useEffect(() => {
    if (!prefillText) return;
    if (prefillAutoSend) {
      void send(prefillText, prefillSource ?? "text");
    } else {
      inputRef.current?.setValue(prefillText);
      inputRef.current?.focus();
    }
    onPrefillConsumed?.();
  }, [prefillAutoSend, prefillSource, prefillText, onPrefillConsumed, send]);

  useEffect(() => {
    if (!autoStartVoice) return;
    const t = setTimeout(() => {
      void inputRef.current?.startVoice();
      onAutoVoiceConsumed?.();
    }, 100);
    return () => clearTimeout(t);
  }, [autoStartVoice, onAutoVoiceConsumed]);

  return (
    <div
      className="relative isolate flex flex-col overflow-hidden bg-background"
      style={{
        height: "calc(100dvh - 52px - 64px - env(safe-area-inset-bottom))",
      }}
    >
      {/* Animated Gemini-style ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.35),transparent_70%)] blur-3xl animate-[nouri-float-a_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.30),transparent_70%)] blur-3xl animate-[nouri-float-b_18s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.30),transparent_70%)] blur-3xl animate-[nouri-float-c_16s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-background/40 backdrop-blur-2xl" />
      </div>

      <MessageList
        rows={rows}
        meals={meals}
        onOpenMeal={setOpenMealId}
        onResolveChatJob={resolveChatJob}
        onPickPrompt={(text) => {
          inputRef.current?.setValue(text);
          inputRef.current?.focus();
        }}
      />

      {rows.length > 0 && (
        <div className="text-center pb-1">
          <button onClick={clearConversation}
            className="text-[11px] text-muted-foreground hover:text-foreground">
            Clear conversation
          </button>
        </div>
      )}

      {pendingClarification?.question && (
        <div className="px-4 pb-2 shrink-0">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-primary font-medium">
                Nutri AI needs one more detail
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {pendingClarification.question}
              </p>
              <p className="text-xs text-muted-foreground">
                A rough amount is enough. You can answer with bites, pieces, cups, grams, or a quick estimate.
              </p>
            </div>
            {pendingClarification.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingClarification.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => { void send(option, "text"); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/25 bg-background hover:border-primary/50 transition-colors text-foreground"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {pendingClarification.source === "voice" && (
              <button
                onClick={() => { void inputRef.current?.startVoice(); }}
                className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80"
              >
                <Mic size={14} />
                Press to answer by voice
              </button>
            )}
          </div>
        </div>
      )}

      <MessageInput
        ref={inputRef}
        onSend={send}
        onScan={() => setScannerOpen(true)}
        aiStatus={aiStatus}
        placeholder={pendingClarification?.question ?? "Log a meal or ask anything"}
      />

      {openMeal && (
        <MealDetailSheet
          meal={openMeal}
          goals={goals}
          todaySoFar={todaySoFar}
          onClose={() => setOpenMealId(null)}
          onDelete={async () => {
            await onDeleteMeal(openMeal.id);
            setOpenMealId(null);
          }}
        />
      )}

      {pendingPreview && user && (
        <>
          {/* Bridge: subscribe to the meal job and pipe results into the open sheet. */}
          {pendingPreview.jobId && !pendingPreview.meal && !pendingPreview.error && (
            <MealJobBridge
              jobId={pendingPreview.jobId}
              onResolved={(output, status, error) => resolveMealJob(output, status, error)}
            />
          )}
          <AnalyzedMealSheet
            meal={pendingPreview.meal}
            loading={!pendingPreview.meal && !pendingPreview.error}
            error={pendingPreview.error}
            onRetry={() => setPendingPreview(null)}
            onConfirm={async () => {
              const pm = pendingPreview.meal;
              if (!pm) return;
              setPendingPreview(null);
              const meal: Meal = {
                id: crypto.randomUUID(),
                meal_name: pm.meal_name,
                type: pm.type as MealType,
                calories: pm.calories,
                protein: pm.protein,
                carbs: pm.carbs,
                fat: pm.fat,
                date: pm.date,
                created_at: Date.now(),
                micros: pm.micros,
              };
              await onAddMeal(meal);
              const waterMl = inferredWaterMl(meal.meal_name);
              if (waterMl > 0) addWaterIntakeForDate(meal.date, waterMl, user.id);
              await supabase.from("chat_messages").insert({
                user_id: user.id,
                role: "assistant",
                content: pm.tip ?? `Logged ${meal.meal_name}.`,
                meal_id: meal.id,
              });
              toast.success(`Logged ${meal.meal_name}`);
            }}
          />
        </>
      )}

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => { setScannerOpen(false); setScannedBarcode(code); }}
          onPhotoCaptured={(file) => {
            setScannerOpen(false);
            const localBarcode = `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
            setPhotoCapture({ file, barcode: localBarcode });
          }}
        />
      )}

      {scannedBarcode && user && (
        <BarcodeProductSheet
          barcode={scannedBarcode}
          onClose={() => setScannedBarcode(null)}
          onMealReady={async (draft) => {
            setScannedBarcode(null);
            const meal: Meal = {
              ...draft,
              id: crypto.randomUUID(),
              created_at: Date.now(),
            };
            await onAddMeal(meal);
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              role: "assistant",
              content: `Logged ${meal.meal_name}.`,
              meal_id: meal.id,
            });
          }}
        />
      )}

      {photoCapture && user && (
        <PhotoLabelSheet
          file={photoCapture.file}
          barcode={photoCapture.barcode}
          onClose={() => setPhotoCapture(null)}
          onMealReady={async (draft) => {
            setPhotoCapture(null);
            const meal: Meal = { ...draft, id: crypto.randomUUID(), created_at: Date.now() };
            await onAddMeal(meal);
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              role: "assistant",
              content: `Logged ${meal.meal_name}.`,
              meal_id: meal.id,
            });
          }}
        />
      )}
    </div>
  );
}

// Re-export for backwards compat (some code splits import the named lazy chunk).
export default NouriChatScreen;
