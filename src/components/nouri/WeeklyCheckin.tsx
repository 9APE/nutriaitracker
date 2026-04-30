import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Goals, Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { maybeAwardWeeklyCheckin } from "@/lib/nouri-xp";
import { toast } from "sonner";

export const LAST_CHECKIN_KEY = "lastCheckIn";

type ChatMsg = { role: "assistant" | "user"; content: string };

interface CheckinResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar_max?: number;
  saturated_fat_max?: number;
  sodium_max?: number;
  cholesterol_max?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_a?: number;
  summary: string;
}

interface Props {
  goals: Goals;
  meals: Meal[];
  profile?: any;
  onClose: () => void;
  onGoalsUpdated: (g: Goals, full?: CheckinResult) => void;
}

function computeAverages(meals: Meal[]) {
  // Average over last 7 days that actually had logs
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const recent = meals.filter((m) => m.date >= cutoffISO);
  const byDate = new Map<string, { protein: number; calories: number }>();
  for (const m of recent) {
    const d = byDate.get(m.date) ?? { protein: 0, calories: 0 };
    d.protein += m.protein;
    d.calories += m.calories;
    byDate.set(m.date, d);
  }
  const days = byDate.size || 1;
  let pSum = 0;
  let cSum = 0;
  for (const v of byDate.values()) {
    pSum += v.protein;
    cSum += v.calories;
  }
  return { avgProtein: pSum / days, avgCalories: cSum / days };
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-surface border border-border rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

export function WeeklyCheckin({ goals, meals, profile, onClose, onGoalsUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const { avgProtein, avgCalories } = computeAverages(meals);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, waiting, result]);

  async function send(history: ChatMsg[]) {
    setWaiting(true);
    try {
      const { getLanguage, getLanguageName } = await import("@/lib/nouri-i18n");
      const { data, error } = await supabase.functions.invoke("weekly-checkin", {
        body: {
          goals,
          profile,
          avgProtein,
          avgCalories,
          messages: history,
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
        },
      });
      if (error) throw new Error(error.message);
      const visible: string = data?.message ?? "";
      const complete: boolean = !!data?.complete;
      const r: CheckinResult | null = data?.result ?? null;

      if (visible.trim()) {
        setMessages((m) => [...m, { role: "assistant", content: visible.trim() }]);
      }
      if (complete && r) {
        setResult(r);
        const newGoals: Goals = {
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
        };
        onGoalsUpdated(newGoals, r);
        localStorage.setItem(LAST_CHECKIN_KEY, todayISO());
        maybeAwardWeeklyCheckin();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't reach Nouri");
    } finally {
      setWaiting(false);
    }
  }

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || waiting || result) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    await send(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            
            <span className="font-serif text-lg font-medium">Weekly check-in</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-start gap-2 animate-bubble-in">
                
                <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed text-foreground max-w-[85%] whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end animate-bubble-in">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] leading-relaxed max-w-[85%] whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            )
          )}
          {waiting && (
            <div className="flex items-start gap-2">
              
              <TypingDots />
            </div>
          )}

          {result && (
            <div
              className="rounded-2xl border p-4 mt-4 animate-bubble-in"
              style={{
                backgroundColor: "hsl(var(--tone-success-bg))",
                borderColor: "hsl(var(--tone-success-border))",
                color: "hsl(var(--tone-success-fg))",
              }}
            >
              <div className="flex items-start gap-3">
                
                <div className="space-y-3 flex-1">
                  <p className="text-[15px] leading-relaxed">
                    {result.summary}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Pill label="Calories" value={`${result.calories} kcal`} />
                    <Pill label="Protein" value={`${result.protein} g`} />
                    <Pill label="Carbs" value={`${result.carbs} g`} />
                    <Pill label="Fat" value={`${result.fat} g`} />
                  </div>
                  <Button onClick={onClose} className="w-full mt-2">
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!result && (
        <div className="border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="max-w-md mx-auto flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              className="flex-1"
              disabled={waiting}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || waiting}>
              {waiting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono-data text-sm text-foreground">{value}</div>
    </div>
  );
}

// ── Helpers exposed for the banner ──────────────────────────────────────────
export function getLastCheckinISO(): string | null {
  try {
    return localStorage.getItem(LAST_CHECKIN_KEY);
  } catch {
    return null;
  }
}

/**
 * True if the user is due for a check-in (no record yet → due after 7 days
 * since signup; otherwise due 7 days after the last check-in).
 */
export function isCheckinDue(signupISO?: string | null): boolean {
  const last = getLastCheckinISO();
  const today = todayISO();
  const refISO = last ?? signupISO ?? today;
  const ref = new Date(refISO + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diffDays = Math.round((now.getTime() - ref.getTime()) / 86400000);
  return diffDays >= 7;
}
