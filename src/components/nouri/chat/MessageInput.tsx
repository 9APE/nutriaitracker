/**
 * MessageInput  composer for the Nouri chat.
 *
 * Owns the text field + voice + barcode trigger. Calls back up for send.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Send, Mic, Square, Loader2, ScanLine } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";

export interface MessageInputHandle {
  /** Programmatically focus the textarea (e.g. from a suggestion chip). */
  focus: () => void;
  /** Replace the current draft text. */
  setValue: (text: string) => void;
  /** Re-open the microphone for a follow-up answer. */
  startVoice: () => Promise<void>;
}

interface MessageInputProps {
  onSend: (text: string, source: "voice" | "text") => void | Promise<void>;
  onScan: () => void;
  placeholder?: string;
  aiStatus?: "Analyzing meal" | "Needs detail" | "In progress" | "Ready" | string;
}

const INPUT_AI_TONES: Record<string, { rail: string; label: string; accent: string }> = {
  "Analyzing meal": {
    rail: "from-cyan-500 via-sky-500 to-teal-500",
    label: "Nutri AI is reading your meal",
    accent: "text-cyan-700",
  },
  "Needs detail": {
    rail: "from-amber-400 via-orange-400 to-rose-400",
    label: "Nutri AI just needs one quick detail",
    accent: "text-amber-700",
  },
  "In progress": {
    rail: "from-violet-500 via-fuchsia-500 to-cyan-500",
    label: "Nutri AI is thinking in the background",
    accent: "text-violet-700",
  },
  Ready: {
    rail: "from-emerald-400 via-teal-400 to-cyan-400",
    label: "Ready to ask, log, or scan",
    accent: "text-emerald-700",
  },
};

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  function MessageInput({ onSend, onScan, placeholder, aiStatus = "Ready" }, ref) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const voice = useVoice();

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      setValue: (text: string) => setInput(text),
      startVoice: async () => {
        voice.reset();
        setInput("");
        await voice.start();
      },
    }), []);

    const isRecording = voice.listening;
    const isTranscribing = voice.transcribing;
    const aiTone = INPUT_AI_TONES[aiStatus] ?? INPUT_AI_TONES.Ready;
    const showExpandedScan = !input.trim() && !isRecording && !isTranscribing;

    const submit = async (text?: string, source: "voice" | "text" = "text") => {
      const value = (text ?? input).trim();
      if (!value) return;
      setInput("");
      await onSend(value, source);
    };

    const handleMic = async () => {
      if (isRecording) {
        const text = await voice.stop();
        if (text) await submit(text, "voice");
      } else {
        voice.reset();
        await voice.start();
      }
    };

    const handleKey = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    };

    return (
      <div className="px-4 pb-2 pt-2 border-t border-white/20 bg-background/75 backdrop-blur-xl shrink-0">
        <div className="overflow-hidden rounded-3xl border border-primary/15 bg-card/88 shadow-[0_12px_35px_rgba(15,23,42,0.10)]">
          <div className={`h-1 bg-gradient-to-r ${aiTone.rail} ${aiStatus === "Ready" && !isRecording && !isTranscribing ? "opacity-70" : "animate-pulse"}`} />
          <div className="flex items-end gap-2 px-3 py-2">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder ?? "Log a meal or ask anything"} rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 leading-relaxed placeholder:text-muted-foreground"
            style={{ fieldSizing: "content" } as any}
            disabled={isRecording} />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onScan}
              className={`group overflow-hidden rounded-2xl border transition-all active:scale-95 ${showExpandedScan ? "border-cyan-500/20 bg-cyan-500/8 px-3 py-2 text-cyan-700 shadow-[0_8px_20px_rgba(6,182,212,0.10)] hover:-translate-y-0.5 hover:bg-cyan-500/12" : "border-transparent p-2 text-muted-foreground hover:-translate-y-0.5 hover:bg-cyan-500/10 hover:text-cyan-700"}`}
              aria-label="Scan barcode">
              <span className="flex items-center gap-2">
                <span className={`grid place-items-center rounded-xl ${showExpandedScan ? "bg-cyan-500/10 p-1" : ""}`}>
                  <ScanLine size={18} />
                </span>
                {showExpandedScan && (
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span>Scan label</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  </span>
                )}
              </span>
            </button>
            <button onClick={handleMic}
              disabled={isTranscribing}
              className={`rounded-2xl p-2 transition-all active:scale-95 ${isRecording ? "bg-rose-500/15 text-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,0.08)]" : isTranscribing ? "bg-violet-500/12 text-violet-700" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-violet-500/10 hover:text-violet-700"}`}
              aria-label={isRecording ? "Stop" : "Voice"}>
              {isTranscribing ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={() => submit()} disabled={!input.trim()}
              className="rounded-2xl bg-[linear-gradient(135deg,hsl(var(--primary))_0%,#22c55e_100%)] p-2 text-primary-foreground shadow-[0_10px_24px_rgba(14,165,233,0.18)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none">
              <Send size={18} />
            </button>
          </div>
        </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 pb-2 pt-1.5">
            <p className={`text-[11px] ${aiTone.accent}`}>
              {isRecording
                ? "Listening..."
                : isTranscribing
                  ? "Turning your voice into a meal log..."
                  : aiTone.label}
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full bg-current ${aiTone.accent} ${isRecording || isTranscribing ? "animate-pulse" : "opacity-40"}`} />
              <span className={`h-1.5 w-1.5 rounded-full bg-current ${aiTone.accent} ${(input.trim() || aiStatus !== "Ready") ? "opacity-70" : "opacity-30"}`} />
              <span className={`h-1.5 w-1.5 rounded-full bg-current ${aiTone.accent} ${input.trim() ? "opacity-100" : "opacity-30"}`} />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
