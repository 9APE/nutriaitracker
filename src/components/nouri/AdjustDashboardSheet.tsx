import { useState } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { generateLayout, saveLayout, type DashboardLayout } from "@/lib/nouri-dashboard-layout";
import type { Goals } from "@/lib/nouri-storage";

interface Props {
  open: boolean;
  onClose: () => void;
  profile: any;
  goals: Goals;
  currentLayout: DashboardLayout | null;
  onUpdated: (layout: DashboardLayout) => void;
}

export function AdjustDashboardSheet({ open, onClose, profile, goals, currentLayout, onUpdated }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const layout = await generateLayout({
        profile,
        goals,
        currentLayout,
        userMessage: text,
      });
      saveLayout(layout);
      onUpdated(layout);
      toast.success("Dashboard updated");
      setInput("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update dashboard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-bubble-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span className="font-serif text-base font-medium">Adjust dashboard</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed text-foreground">
            What would you like to focus on? Tell me your current goals or any changes and I'll update your dashboard.
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. I want to focus on lowering sodium…"
              disabled={busy}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!input.trim() || busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
