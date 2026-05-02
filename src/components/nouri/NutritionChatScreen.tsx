import { useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/hooks/useVoice";
import { todayISO } from "@/lib/nouri-storage";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";
import type { Goals, Meal } from "@/lib/nouri-storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  timestamp: number;
}

interface Props {
  goals: Goals;
  meals: Meal[];
}

const CHAT_KEY = "nutriai:chat";
const MAX_STORED = 60;

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

function CitationList({ citations }: { citations: string[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sources</p>
      {citations.map((url, i) => {
        let label = url;
        try {
          const u = new URL(url);
          label = u.hostname.replace(/^www\./, "");
        } catch {}
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
          >
            <ExternalLink size={10} className="shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function NutritionChatScreen({ goals, meals }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);

  // Voice input
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoice({
    onTranscript: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text));
      inputRef.current?.focus();
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch fresh profile from Supabase every time
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
        return data.user_profile_json;
      }
    } catch {}
    try {
      const raw = localStorage.getItem("userProfile");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
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

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)]">
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
        {messages.length === 0 && !loading && (
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
