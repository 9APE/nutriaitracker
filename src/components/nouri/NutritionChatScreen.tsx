import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Mic, Square, Loader2, ExternalLink, AlertTriangle, RefreshCw, Plus, UtensilsCrossed, Cookie } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { todayISO } from "@/lib/nouri-storage";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";
import { toast } from "sonner";
import type { Goals, Meal, MealType } from "@/lib/nouri-storage";
import { getMergedFamilyRestrictions } from "@/lib/family-utils";
import { useFamilyMode } from "@/components/nouri/FamilyModeToggle";

// ── Types ────────────────────────────────────────────────────────────────────

interface Citation { title: string; url: string; }

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface MealSuggestion {
  meal_name: string;
  meal_type: string;
  why: string;
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
}

interface Props {
  goals: Goals;
  meals: Meal[];
  onAddMeal?: (meal: Meal) => void;
}

const CHAT_KEY = "nutriai:chat";
const MAX_STORED = 60;

function getNextMealType(): MealType {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "Breakfast";
  if (h < 15.5) return "Lunch";
  return "Dinner";
}

function loadHistory(): ChatMessage[] {
  try { const r = localStorage.getItem(CHAT_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveHistory(msgs: ChatMessage[]) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-MAX_STORED))); } catch {}
}
function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Citation list ────────────────────────────────────────────────────────────

function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sources</p>
      {citations.map((c, i) => (
        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
          <ExternalLink size={10} className="shrink-0" />
          <span className="truncate">{c.title}</span>
        </a>
      ))}
    </div>
  );
}

// ── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({ s, onLog, onAsk, logging }: {
  s: MealSuggestion;
  onLog: () => void;
  onAsk: () => void;
  logging: boolean;
}) {
  const isSnack = s.meal_type?.toLowerCase() === "snack";
  return (
    <div className="flex-shrink-0 w-52 bg-card border border-border rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          isSnack ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"
        }`}>
          {s.meal_type || "Meal"}
        </span>
        {isSnack ? <Cookie size={12} className="text-amber-500/60" /> : <UtensilsCrossed size={12} className="text-primary/40" />}
      </div>
      <p className="text-sm font-medium leading-tight line-clamp-2">{s.meal_name}</p>
      <div className="flex gap-2 text-[10px] text-muted-foreground">
        <span>{s.calories} kcal</span>
        <span>·</span>
        <span>{s.protein}g P</span>
      </div>
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onAsk}
          className="flex-1 text-[11px] py-1 rounded-lg border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
          Ask about this
        </button>
        <button onClick={onLog} disabled={logging}
          className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50">
          {logging ? <Loader2 size={11} className="animate-spin text-primary" /> : <Plus size={11} className="text-primary" />}
        </button>
      </div>
    </div>
  );
}

// ── Suggested meals strip ────────────────────────────────────────────────────

function SuggestedMealsStrip({ goals, todayMeals, getProfile, onAsk, onLog, familyMode, familyRestrictions }: {
  goals: Goals;
  todayMeals: Meal[];
  getProfile: () => Promise<Record<string, any> | null>;
  onAsk: (name: string) => void;
  onLog: (s: MealSuggestion) => void;
  familyMode: boolean;
  familyRestrictions?: ReturnType<typeof getMergedFamilyRestrictions>;
}) {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const shownRef = useRef<string[]>([]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getProfile();
      const totals = todayMeals.reduce(
        (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const remaining = {
        calories: Math.max(0, (goals.calories || 0) - totals.calories),
        protein: Math.max(0, (goals.protein || 0) - totals.protein),
        carbs: Math.max(0, (goals.carbs || 0) - totals.carbs),
        fat: Math.max(0, (goals.fat || 0) - totals.fat),
      };
      const { data } = await supabase.functions.invoke("recommend-meals", {
        body: {
          remaining, totals, goals, profile,
          todayMealNames: todayMeals.map((m) => m.meal_name),
          training: "",
          recentlyRecommended: shownRef.current,
          currentHour: new Date().getHours(),
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
          familyMode,
          familyRestrictions,
        },
      });
      const list: MealSuggestion[] = data?.suggestions ?? [];
      setSuggestions(list);
      shownRef.current = [...shownRef.current, ...list.map((s) => s.meal_name)];
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [goals, todayMeals.length]);

  useEffect(() => { fetchSuggestions(); }, []);

  function handleLog(s: MealSuggestion) {
    setLoggingId(s.meal_name);
    onLog(s);
    setSuggestions((prev) => prev.filter((x) => x.meal_name !== s.meal_name));
    setLoggingId(null);
  }

  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Suggested for your next meal</p>
        <button onClick={fetchSuggestions} disabled={loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          aria-label="Refresh suggestions">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {[0,1,2].map((i) => (
            <div key={i} className="flex-shrink-0 w-52 h-28 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} s={s}
              onAsk={() => onAsk(s.meal_name)}
              onLog={() => handleLog(s)}
              logging={loggingId === s.meal_name}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function NutritionChatScreen({ goals, meals, onAddMeal }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);
  const [familyMode] = useFamilyMode();

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoice({
    onTranscript: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text));
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Always merge Supabase + localStorage so restriction arrays are never lost
  async function getFreshProfile(): Promise<Record<string, any> | null> {
    let local: Record<string, any> | null = null;
    try { const r = localStorage.getItem("userProfile"); local = r ? JSON.parse(r) : null; } catch {}
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return local;
      const { data } = await supabase.from("profiles").select("user_profile_json").eq("id", user.id).maybeSingle();
      if (data?.user_profile_json) {
        const remote = data.user_profile_json;
        const merged = {
          ...(local ?? {}), ...remote,
          restrictions: remote.restrictions?.length ? remote.restrictions : (local?.restrictions ?? []),
          conditions:   remote.conditions?.length   ? remote.conditions   : (local?.conditions   ?? []),
          allergies:    remote.allergies?.length     ? remote.allergies    : (local?.allergies    ?? []),
          dislikes:     remote.dislikes?.length      ? remote.dislikes     : (local?.dislikes     ?? []),
        };
        localStorage.setItem("userProfile", JSON.stringify(merged));
        return merged;
      }
    } catch {}
    return local;
  }

  function handleSuggestionAsk(mealName: string) {
    setInput(`Tell me more about "${mealName}" — is it right for my goals?`);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function handleSuggestionLog(s: MealSuggestion) {
    if (!onAddMeal) return;
    const meal: Meal = {
      id: uid(), meal_name: s.meal_name,
      type: (s.meal_type as MealType) || getNextMealType(),
      calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat,
      date: today, created_at: Date.now(),
    };
    onAddMeal(meal);
    toast.success(`${s.meal_name} logged!`);
  }

  // Detect preference updates from user messages and save to profile
  async function detectPreferenceUpdate(message: string, profile: Record<string, any> | null) {
    try {
      const { data } = await supabase.functions.invoke("detect-preference-update", {
        body: { message, profile: profile ?? {} },
      });
      if (!data?.field) return;
      const { field, action, value } = data as { field: string; action: string; value: string };
      const updated = { ...(profile ?? {}) };
      const arr: string[] = Array.isArray(updated[field]) ? [...updated[field]] : [];
      if (action === "add" && !arr.includes(value)) arr.push(value);
      else if (action === "remove") { const i = arr.indexOf(value); if (i >= 0) arr.splice(i, 1); }
      updated[field] = arr;
      localStorage.setItem("userProfile", JSON.stringify(updated));
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ user_profile_json: updated }).eq("id", user.id);
      toast.success(`✓ ${value} ${action === "remove" ? "removed from" : "added to"} your ${field}`);
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, timestamp: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next); saveHistory(next); setInput(""); setLoading(true);
    try {
      const profile = await getFreshProfile();
      const familyRestrictions = familyMode ? getMergedFamilyRestrictions() : undefined;
      const { data, error } = await supabase.functions.invoke("nutrition-chat", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          profile, goals, todayMeals,
          language: getLanguage() ?? "en", languageName: getLanguageName(),
          familyMode,
          familyRestrictions,
        },
      });
      if (error) throw new Error(error.message);
      const aiMsg: ChatMessage = {
        id: uid(), role: "assistant",
        content: data?.content || "Sorry, I couldn't generate a response.",
        citations: data?.citations ?? [], timestamp: Date.now(),
      };
      const withAI = [...next, aiMsg];
      setMessages(withAI); saveHistory(withAI);
      detectPreferenceUpdate(text, profile);
    } catch {
      const errMsg: ChatMessage = { id: uid(), role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: Date.now() };
      const withErr = [...next, errMsg];
      setMessages(withErr); saveHistory(withErr);
    } finally { setLoading(false); }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)]">
      {/* Disclaimer */}
      <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
        <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Not medical advice.</span>{" "}
          NutriAI references research but is not a medical professional. Consult your doctor for health decisions.
        </p>
      </div>

      {/* Suggested meals — always visible at top */}
      <SuggestedMealsStrip
        goals={goals} todayMeals={todayMeals}
        getProfile={getFreshProfile}
        onAsk={handleSuggestionAsk}
        onLog={handleSuggestionLog}
        familyMode={familyMode}
        familyRestrictions={familyMode ? getMergedFamilyRestrictions() : undefined}
      />

      <div className="border-t border-border/50 mx-4" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 text-center px-4 pt-2">
            <p className="text-sm text-muted-foreground">Tap a card above to log it or ask about it, or try:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["How much protein left?", "What should I avoid?", "Am I on track?"].map((q) => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 transition-colors text-muted-foreground">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "user" ? (
              <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[88%] bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && <CitationList citations={msg.citations} />}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
        <div className="text-center pb-1">
          <button onClick={() => { setMessages([]); localStorage.removeItem(CHAT_KEY); }}
            className="text-[11px] text-muted-foreground hover:text-foreground">
            Clear conversation
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-background">
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-3 py-2">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey} placeholder="Ask anything about nutrition…" rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 leading-relaxed placeholder:text-muted-foreground"
            style={{ fieldSizing: "content" } as any} disabled={loading || isRecording} />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || isTranscribing}
              className={`p-2 rounded-xl transition-colors ${isRecording ? "bg-red-500/15 text-red-500" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              aria-label={isRecording ? "Stop" : "Voice"}>
              {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : isRecording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={send} disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
              aria-label="Send">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
