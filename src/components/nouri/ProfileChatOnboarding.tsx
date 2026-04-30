import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Send, X, Mic, Loader2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { toast } from "sonner";
import type { Goals } from "@/lib/nouri-storage";

// ── Types & storage helpers ──────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  age: number;
  height: string;
  weight: string;
  sex: string;
  goals: string;
  conditions: string[];
  restrictions: string[];
  activityLevel: string;
  dislikes: string[];
  allergies: string[];
}

export interface PlanResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  reasoning: string;
  warnings: string[];
}

const PROFILE_KEY = "userProfile";
const WARNINGS_KEY = "userWarnings";

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUserProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function saveUserWarnings(w: string[]) {
  localStorage.setItem(WARNINGS_KEY, JSON.stringify(w));
}

// ── Sub-components ───────────────────────────────────────────────────────────
type ChatMessage = { role: "assistant" | "user"; content: string };

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

// ── Main component ───────────────────────────────────────────────────────────
type Phase = "chat" | "plan-loading" | "plan-show" | "plan-adjust";

interface Props {
  initial?: UserProfile | null;
  onDone: (data: { profile: UserProfile; goals: Goals; warnings: string[] }) => void;
  onClose?: () => void;
}

export function ProfileChatOnboarding({ initial, onDone, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [adjusted, setAdjusted] = useState<Goals | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoice();
  const startedRef = useRef(false);

  // Kick off Claude's opening message on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void sendToClaude([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting, phase]);

  // Voice errors
  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  // After transcribing, fill input
  useEffect(() => {
    if (voice.transcript) setInput((cur) => (cur ? cur + " " + voice.transcript : voice.transcript));
  }, [voice.transcript]);

  async function sendToClaude(history: ChatMessage[]) {
    setWaiting(true);
    try {
      const { getLanguage } = await import("@/lib/nouri-i18n");
      const { data, error } = await supabase.functions.invoke("onboarding-chat", {
        body: { mode: "chat", messages: history, language: getLanguage() ?? "en" },
      });
      if (error) throw new Error(error.message);
      const visible: string = data?.message ?? "";
      const complete: boolean = !!data?.complete;
      const profileJson: UserProfile | null = data?.profile ?? null;

      if (visible.trim()) {
        setMessages((m) => [...m, { role: "assistant", content: visible.trim() }]);
      }

      if (complete && profileJson) {
        setProfile(profileJson);
        saveUserProfile(profileJson);
        await fetchPlan(profileJson);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't reach Nouri. Try again.");
    } finally {
      setWaiting(false);
    }
  }

  async function fetchPlan(p: UserProfile) {
    setPhase("plan-loading");
    try {
      const { getLanguage } = await import("@/lib/nouri-i18n");
      const { data, error } = await supabase.functions.invoke("onboarding-chat", {
        body: { mode: "goals", profile: p, language: getLanguage() ?? "en" },
      });
      if (error) throw new Error(error.message);
      const plan: PlanResult = data?.plan;
      if (!plan) throw new Error("No plan returned");
      setPlan(plan);
      setAdjusted({ calories: plan.calories, protein: plan.protein, carbs: plan.carbs, fat: plan.fat });
      setPhase("plan-show");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't build your plan");
      setPhase("chat");
    }
  }

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    await sendToClaude(next);
  };

  const handleMic = async () => {
    if (voice.listening) {
      await voice.stop();
    } else {
      voice.reset();
      await voice.start();
    }
  };

  const acceptPlan = () => {
    if (!profile || !plan || !adjusted) return;
    saveUserWarnings(plan.warnings);
    onDone({ profile, goals: adjusted, warnings: plan.warnings });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (phase === "plan-loading") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <div className="text-5xl animate-bubble-in">🌿</div>
        <Loader2 className="animate-spin text-primary" size={28} />
        <p className="text-foreground font-serif text-lg">Nouri is building your personalised plan…</p>
        <p className="text-muted-foreground text-sm max-w-xs">
          Calculating your daily targets based on everything you shared.
        </p>
      </div>
    );
  }

  if (phase === "plan-show" && plan && profile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto">
        <header className="px-5 py-4 border-b border-border">
          <div className="max-w-md mx-auto flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-serif text-lg font-medium">Nouri</span>
          </div>
        </header>

        <div className="flex-1 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto space-y-5">
            <h1 className="font-serif text-2xl font-medium leading-tight">
              Here is your personalised plan, {profile.name || "friend"}!
            </h1>

            <div className="grid grid-cols-2 gap-3">
              <MacroCard label="Calories" value={plan.calories} unit="kcal" />
              <MacroCard label="Protein" value={plan.protein} unit="g" />
              <MacroCard label="Carbs" value={plan.carbs} unit="g" />
              <MacroCard label="Fat" value={plan.fat} unit="g" />
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex gap-3">
              <span className="text-xl shrink-0">🌿</span>
              <p className="text-sm leading-relaxed text-foreground">{plan.reasoning}</p>
            </div>

            {plan.warnings.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Things to watch</h2>
                <ul className="space-y-2">
                  {plan.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex gap-2 items-start rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      <span className="shrink-0">⚠️</span>
                      <span className="leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button onClick={acceptPlan} className="w-full h-12 text-base">
                Looks good, let's go! ✅
              </Button>
              <Button
                variant="outline"
                onClick={() => setPhase("plan-adjust")}
                className="w-full h-12 text-base"
              >
                I want to adjust these
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "plan-adjust" && plan && adjusted) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto">
        <header className="px-5 py-4 border-b border-border">
          <div className="max-w-md mx-auto flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-serif text-lg font-medium">Nouri</span>
          </div>
        </header>
        <div className="flex-1 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto space-y-5">
            <h1 className="font-serif text-2xl font-medium">Adjust your plan</h1>
            <p className="text-sm text-muted-foreground -mt-3">
              Tweak any target. The AI recommendation is shown beside each.
            </p>

            <AdjustSlider
              label="Calories"
              unit="kcal"
              min={1200}
              max={4500}
              step={50}
              value={adjusted.calories}
              recommended={plan.calories}
              onChange={(v) => setAdjusted({ ...adjusted, calories: v })}
            />
            <AdjustSlider
              label="Protein"
              unit="g"
              min={40}
              max={300}
              step={5}
              value={adjusted.protein}
              recommended={plan.protein}
              onChange={(v) => setAdjusted({ ...adjusted, protein: v })}
            />
            <AdjustSlider
              label="Carbs"
              unit="g"
              min={50}
              max={500}
              step={5}
              value={adjusted.carbs}
              recommended={plan.carbs}
              onChange={(v) => setAdjusted({ ...adjusted, carbs: v })}
            />
            <AdjustSlider
              label="Fat"
              unit="g"
              min={20}
              max={200}
              step={2}
              value={adjusted.fat}
              recommended={plan.fat}
              onChange={(v) => setAdjusted({ ...adjusted, fat: v })}
            />

            <div className="space-y-2 pt-2">
              <Button onClick={acceptPlan} className="w-full h-12 text-base">
                Save my plan ✅
              </Button>
              <Button
                variant="outline"
                onClick={() => setPhase("plan-show")}
                className="w-full h-12 text-base"
              >
                Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: chat phase
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-serif text-lg font-medium">Nouri</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {onClose && (
          <p className="max-w-md mx-auto mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Earn a freeze by logging 7 days in a row.</span>
          </p>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-start gap-2 animate-bubble-in">
                <div className="text-xl shrink-0 pt-1">🌿</div>
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
          {(waiting || voice.transcribing) && (
            <div className="flex items-start gap-2">
              <div className="text-xl shrink-0 pt-1">🌿</div>
              <TypingDots />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitText(input);
          }}
          className="max-w-md mx-auto flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voice.listening ? "Listening…" : "Type your answer…"}
            className="flex-1"
            disabled={waiting || voice.listening || voice.transcribing}
          />
          {voice.supported && (
            <Button
              type="button"
              size="icon"
              variant={voice.listening ? "destructive" : "outline"}
              onClick={handleMic}
              disabled={waiting || voice.transcribing}
              aria-label={voice.listening ? "Stop recording" : "Record voice"}
            >
              {voice.listening ? <Square size={16} /> : <Mic size={16} />}
            </Button>
          )}
          <Button type="submit" size="icon" disabled={!input.trim() || waiting}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── small UI helpers ─────────────────────────────────────────────────────────
function MacroCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono-data text-2xl text-foreground">
        {value}
        <span className="text-base text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}

function AdjustSlider({
  label,
  unit,
  min,
  max,
  step,
  value,
  recommended,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  recommended: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono-data text-sm">
          {value}
          <span className="text-muted-foreground ml-0.5">{unit}</span>
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="text-[11px] text-muted-foreground mt-2">
        AI recommended: <span className="font-mono-data">{recommended} {unit}</span>
      </div>
    </div>
  );
}
