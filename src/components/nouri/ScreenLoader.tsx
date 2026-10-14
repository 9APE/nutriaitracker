import { Loader2 } from "lucide-react";

/** Lightweight fallback shown while a lazy-loaded screen chunk is fetched. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={20} className="animate-spin" aria-hidden />
      <span className="text-xs uppercase tracking-wider">
        {label ?? "Loading"}
      </span>
    </div>
  );
}
