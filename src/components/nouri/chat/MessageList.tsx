/**
 * MessageList  pure rendering of the chat transcript.
 *
 * Owns nothing besides scroll-to-bottom. All AI orchestration lives in
 * useNouriChat; this component just paints rows + delegates resolutions.
 */
import { useEffect, useRef } from "react";
import { ExternalLink, Loader2, ChevronRight } from "lucide-react";
import { useAiJobRealtime } from "@/hooks/useAiJobRealtime";
import type { Meal } from "@/lib/nouri-storage";
import type { ChatRow, Citation } from "./types";
import { renderMarkdown } from "@/lib/renderMarkdown";

interface MessageListProps {
  rows: ChatRow[];
  meals: Meal[];
  onOpenMeal: (id: string) => void;
  onResolveChatJob: (
    pendingRowId: string,
    output: any,
    status: "done" | "failed",
    error?: string,
  ) => void;
  /** Quick-prompt chips for the empty state. */
  onPickPrompt: (text: string) => void;
}

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

/** A pending assistant bubble that watches its ai_jobs row. */
function PendingAssistant({
  jobId,
  onResolved,
}: {
  jobId: string;
  onResolved: (output: any, status: "done" | "failed", error?: string) => void;
}) {
  const job = useAiJobRealtime(jobId);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!job || firedRef.current) return;
    if (job.status === "done") {
      firedRef.current = true;
      onResolved(job.output, "done");
    } else if (job.status === "failed") {
      firedRef.current = true;
      onResolved(null, "failed", job.error ?? "AI request failed");
    }
  }, [job, onResolved]);

  return (
    <div className="flex justify-start">
      <div className="relative w-full max-w-[88%] overflow-hidden rounded-3xl border border-primary/15 bg-card/90 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 animate-pulse" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[nouri-shimmer_2.2s_ease-in-out_infinite] dark:via-white/10"
        />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Loader2 size={14} className="animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Nutri AI is thinking</p>
            <span className="text-xs text-muted-foreground">
              Working in the background so you can keep moving.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealCardBubble({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      className="w-full max-w-[88%] text-left bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-primary">Logged</div>
          <p className="text-sm font-medium leading-tight mt-0.5 truncate">{meal.meal_name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {meal.type}  {meal.calories} kcal  {meal.protein}g P  {meal.carbs}g C  {meal.fat}g F
          </p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Tap for full nutrition</p>
    </button>
  );
}

export function MessageList({
  rows,
  meals,
  onOpenMeal,
  onResolveChatJob,
  onPickPrompt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-5 pb-2 pt-8 text-center">
          <div className="max-w-[22rem] space-y-1">
            <p className="text-base font-medium text-foreground">
              Start with one thing.
            </p>
            <p className="text-sm text-muted-foreground">
              Tell Nutri AI what you ate, ask a nutrition question, or use a quick prompt.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "I had 100g oats with milk and a banana",
              "How much protein left?",
              "What should I avoid tonight?",
            ].map((q) => (
              <button key={q} onClick={() => onPickPrompt(q)}
                className="rounded-full border border-border/80 bg-card/90 px-3.5 py-2 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.map((r) => {
        if (r.role === "user") {
          return (
            <div key={r.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-[22px] rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-[0_10px_22px_rgba(14,165,233,0.18)]">
                {r.content}
              </div>
            </div>
          );
        }
        if (r.active_job_id && !r.content) {
          return (
            <PendingAssistant
              key={r.id}
              jobId={r.active_job_id}
              onResolved={(output, status, error) =>
                onResolveChatJob(r.id, output, status, error)
              }
            />
          );
        }
        if (r.meal_id) {
          const meal = meals.find((m) => m.id === r.meal_id);
          return (
            <div key={r.id} className="flex flex-col items-start gap-1">
              {meal ? (
                <MealCardBubble meal={meal} onOpen={() => onOpenMeal(meal.id)} />
              ) : null}
              {r.content ? (
                <div className="max-w-[88%] rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <p className="text-sm leading-relaxed">{renderMarkdown(r.content)}</p>
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <div key={r.id} className="flex justify-start">
            <div className="max-w-[88%] rounded-[22px] rounded-tl-sm border border-border bg-card/95 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <p className="text-sm leading-relaxed">{renderMarkdown(r.content ?? '')}</p>
              {r.citations && Array.isArray(r.citations) && (
                <CitationList citations={r.citations as Citation[]} />
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/**
 * Headless bridge  subscribes to a meal-analysis job and forwards the result.
 * Exported here so the parent can wire pendingPreview without managing realtime
 * directly.
 */
export function MealJobBridge({
  jobId,
  onResolved,
}: {
  jobId: string;
  onResolved: (output: any, status: "done" | "failed", error?: string) => void;
}) {
  const job = useAiJobRealtime(jobId);
  const firedRef = useRef(false);
  useEffect(() => {
    if (!job || firedRef.current) return;
    if (job.status === "done") {
      firedRef.current = true;
      onResolved(job.output, "done");
    } else if (job.status === "failed") {
      firedRef.current = true;
      onResolved(null, "failed", job.error ?? "AI request failed");
    }
  }, [job, onResolved]);
  return null;
}
