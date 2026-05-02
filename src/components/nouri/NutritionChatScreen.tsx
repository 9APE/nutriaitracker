import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Mic, Square, Loader2, ExternalLink, AlertTriangle, Plus, UtensilsCrossed, Cookie } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { todayISO } from "@/lib/nouri-storage";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";
import { toast } from "sonner";
import type { Goals, Meal, MealType } from "@/lib/nouri-storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface Citation {
  title: string;
  url: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface SuggestionCard {
  meal_name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  type: MealType;
}

interface Props {
  goals: Goals;
  meals: Meal[];
  onAddMeal?: (meal: Meal) => void;
}

const CHAT_KEY = "nutriai:chat";
const MAX_STORED = 60;

// ── Time-based meal detection ────────────────────────────────────────────────

function getNextMealType(): MealType {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "Breakfast";
  if (h < 15.5) return "Lunch";
  return "Dinner";
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-MAX_STORED)));
  } catch {}
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Citation display ─────────────────────────────────────────────────────────

function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sources</p>
      {citations.map((c, i) => (
        <a
          key={i}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
        >
          <ExternalLink size={10} className="shrink-0" />
          <span className="truncate">{c.title}</span>
        </a>
      ))}
    </div>
  );
}

// ── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCardUI({
  suggestion,
  onLog,
  logging,
}: {
  suggestion: SuggestionCard;
  onLog: () => void;
  logging: boolean;
}) {
  const isSnack = suggestion.type === "Snack";
  return (
    <button
      onClick={onLog}
      disabled={logging}
      className="relative flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98] disabled:opacity-60 w-full"
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSnack ? "bg-amber-500/10" : "bg-primary/10"}`}>
          {isSnack ? <Cookie size={14} className="text-amber-500" /> : <UtensilsCrossed size={14} className="text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{suggestion.meal_name}</p>
          <span className={`text-[10px] font-medium uppercase tracking-wider ${isSnack ? "text-amber-500" : "text-primary"}`}>
            {suggestion.type}
          </span>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {logging ? <Loader2 size={12} className="animate-spin text-primary" /> : <Plus size={12} className="text-primary" />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{suggestion.description}</p>
      <div className="flex gap-3 text-[10px] text-muted-foreground font-medium">
        <span>{suggestion.calories} kcal</span>
        <span>{suggestion.protein}g P</span>
        <span>{suggestion.carbs}g C</span>
        <span>{suggestion.fat}g F</span>
      </div>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function NutritionChatScreen({ goals, meals, onAddMeal }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);

  // Voice input
  const voice = useVoice();
  const isRecording = voice.listening;
  const isTranscribing = voice.transcribing;

  const startRecording = async () => {
    voice.reset();
    await voice.start();
  };
  const stopRecording = async () => {
    const text = await voice.stop();
    if (text) {
      setInput((prev) => (prev ? prev + " " + text : text));
      inputRef.current?.focus();
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch fresh profile from Supabase
  async function getFreshProfile(): Promise<Record<string, any> | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_profile_json")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.user_profile_json) {
        localStorage.setItem("userProfile", JSON.stringify(data.user_profile_json));
        return data.user_profile_json as Record<string, any>;
      }
    } catch {}
    try {
      const raw = localStorage.getItem("userProfile");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Auto-suggestions on mount ──────────────────────────────────────────────

  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const profile = await getFreshProfile();
      const mealType = getNextMealType();
      const eaten = todayMeals.reduce(
        (a, m) => ({
          calories: a.calories + m.calories,
          protein: a.protein + m.protein,
          carbs: a.carbs + m.carbs,
          fat: a.fat + m.fat,
          names: [...a.names, m.meal_name],
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, names: [] as string[] }
      );

      const prompt = `Based on my profile and goals, suggest exactly 3 meal ideas in JSON format:
- 2 options for my next meal (${mealType})
- 1 snack option

My profile: ${JSON.stringify(profile ?? {})}
Dietary restrictions: ${(profile as any)?.dietary_restrictions?.join(", ") || "none"}
Allergies: ${(profile as any)?.allergies?.join(", ") || "none"}
Dislikes: ${(profile as any)?.dislikes?.join(", ") || "none"}
Health conditions: ${(profile as any)?.health_conditions?.join(", ") || "none"}

Daily goals: ${goals.calories} kcal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat
Already eaten today: ${eaten.calories} kcal, ${eaten.protein}g protein (${eaten.names.join(", ") || "nothing yet"})

Return ONLY a JSON object: {"suggestions": [{"meal_name": "string", "description": "string (1 sentence)", "calories": number, "protein": number, "carbs": number, "fat": number, "type": "${mealType}" or "Snack"}]}
The first 2 items must be type "${mealType}", the 3rd must be type "Snack". Respect all dietary restrictions strictly.`;

      const { data, error } = await supabase.functions.invoke("nutrition-chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
          profile,
          goals,
          todayMeals,
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
          jsonMode: true,
        },
      });

      if (error) throw error;

      const content = data?.content ?? "";
      // Parse JSON from response
      let jsonStr = content.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];

      const parsed = JSON.parse(jsonStr);
      const items: SuggestionCard[] = (parsed.suggestions ?? []).slice(0, 3).map((s: any, i: number) => ({
        meal_name: String(s.meal_name ?? "Meal"),
        description: String(s.description ?? ""),
        calories: Math.round(Number(s.calories) || 0),
        protein: Math.round(Number(s.protein) || 0),
        carbs: Math.round(Number(s.carbs) || 0),
        fat: Math.round(Number(s.fat) || 0),
        type: i < 2 ? getNextMealType() : "Snack" as MealType,
      }));
      setSuggestions(items);
    } catch (e) {
      console.error("Auto-suggestions failed:", e);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [goals, todayMeals.length]);

  // Fetch suggestions on mount
  useEffect(() => {
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Log suggestion as meal ─────────────────────────────────────────────────

  const handleLogSuggestion = (s: SuggestionCard) => {
    if (!onAddMeal) return;
    setLoggingId(s.meal_name);
    const meal: Meal = {
      id: uid(),
      meal_name: s.meal_name,
      type: s.type,
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
      date: today,
      created_at: Date.now(),
    };
    onAddMeal(meal);
    toast.success(`${s.meal_name} logged!`);
    // Remove from suggestions
    setSuggestions((prev) => prev.filter((x) => x.meal_name !== s.meal_name));
    setLoggingId(null);
  };

  async function detectPreferenceUpdate(message: string, profile: Record<string, any> | null) {
    try {
      const { data } = await supabase.functions.invoke("detect-preference-update", {
        body: { message, profile: profile ?? {} },
      });
      if (!data || !data.field) return;

      const { field, action, value } = data as { field: string; action: string; value: string };
      const updatedProfile = { ...(profile ?? {}) };
      const arr: string[] = Array.isArray(updatedProfile[field]) ? [...updatedProfile[field]] : [];

      if (action === "add" && !arr.includes(value)) {
        arr.push(value);
      } else if (action === "remove") {
        const idx = arr.indexOf(value);
        if (idx >= 0) arr.splice(idx, 1);
      }
      updatedProfile[field] = arr;

      localStorage.setItem("userProfile", JSON.stringify(updatedProfile));

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ user_profile_json: updatedProfile })
          .eq("id", user.id);
      }

      const label = action === "remove" ? "removed from" : "added to";
      toast.success(`✓ Preference saved: ${value} ${label} your ${field}`);
    } catch (e) {
      console.error("Preference detection failed:", e);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, timestamp: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveHistory(next);
    setInput("");
    setLoading(true);

    try {
      const profile = await getFreshProfile();
      const { data, error } = await supabase.functions.invoke("nutrition-chat", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          profile,
          goals,
          todayMeals,
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
        },
      });

      if (error) throw new Error(error.message || "Request failed");

      const aiMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data?.content || "Sorry, I couldn't generate a response.",
        citations: data?.citations ?? [],
        timestamp: Date.now(),
      };
      const withAI = [...next, aiMsg];
      setMessages(withAI);
      saveHistory(withAI);

      detectPreferenceUpdate(text, profile);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      const withErr = [...next, errMsg];
      setMessages(withErr);
      saveHistory(withErr);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem(CHAT_KEY);
  }

  const mealType = getNextMealType();

  return (
    <div className="flex flex-col h-[calc(100dvh-190px)]">
      {/* Disclaimer banner */}
      <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
        <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">AI — Not medical advice.</span>{" "}
          NutriAI references published research but is not a medical professional. Always consult your doctor for health decisions.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {/* Auto-generated suggestions */}
        {(suggestions.length > 0 || suggestionsLoading) && (
          <div className="space-y-2 pb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              🍽️ Suggested for you — {mealType} + Snack
            </p>
            {suggestionsLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Generating personalised suggestions…</span>
              </div>
            ) : (
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <SuggestionCardUI
                    key={s.meal_name}
                    suggestion={s}
                    onLog={() => handleLogSuggestion(s)}
                    logging={loggingId === s.meal_name}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {messages.length === 0 && !loading && suggestions.length === 0 && !suggestionsLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🥗</span>
            </div>
            <p className="font-serif text-lg font-medium">Ask me anything about nutrition</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I know your profile, goals, and what you've eaten today. Try asking:
            </p>
            <div className="space-y-2 w-full max-w-xs">
              {[
                "How much sugar can I have today?",
                "What should I eat for dinner?",
                "Am I getting enough protein?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="w-full text-left text-sm px-4 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                >
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
              <span className="text-sm text-muted-foreground">Searching research…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Clear chat link */}
      {messages.length > 0 && (
        <div className="text-center pb-1">
          <button onClick={clearChat} className="text-[11px] text-muted-foreground hover:text-foreground">
            Clear conversation
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-background">
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about nutrition…"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 leading-relaxed placeholder:text-muted-foreground"
            style={{ fieldSizing: "content" } as any}
            disabled={loading || isRecording}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || isTranscribing}
              className={`p-2 rounded-xl transition-colors ${
                isRecording
                  ? "bg-red-500/15 text-red-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
            >
              {isTranscribing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isRecording ? (
                <Square size={16} />
              ) : (
                <Mic size={16} />
              )}
            </button>
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
