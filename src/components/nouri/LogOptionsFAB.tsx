import { useState, useEffect } from "react";
import { Plus, Mic, Keyboard, Search } from "lucide-react";
import type { Meal } from "@/lib/nouri-storage";
import { FoodDatabase } from "./FoodDatabase";

interface Props {
  onAddMeal: (m: Meal) => Promise<void> | void;
  onGoChat: (opts?: {
    startVoice?: boolean;
    prefill?: { text: string; source?: "voice" | "text"; autoSend?: boolean };
  }) => void;
  meals: Meal[];
}

/**
 * Minimalistic FAB shaped identically to the home '+' button.
 * On tap it expands and three circular satellite buttons appear in an arc.
 * Sits above the bottom tab bar (z-50).
 */
export function LogOptionsFAB({ onGoChat, meals }: Props) {
  const [open, setOpen] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (showBrowse) {
    return <FoodDatabase meals={meals} onClose={() => setShowBrowse(false)} />;
  }

  const startVoice = () => { setOpen(false); onGoChat({ startVoice: true }); };
  const openChat = () => { setOpen(false); onGoChat(); };
  const openFoodDatabase = () => { setOpen(false); setShowBrowse(true); };

  const satellites: { icon: typeof Mic; label: string; onClick: () => void; dx: number; dy: number; delay: number }[] = [
    { icon: Mic, label: "Voice", onClick: startVoice, dx: 0, dy: -78, delay: 0 },
    { icon: Keyboard, label: "Type", onClick: openChat, dx: -55, dy: -55, delay: 40 },
    { icon: Search, label: "Browse", onClick: openFoodDatabase, dx: -78, dy: 0, delay: 80 },
  ];

  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150"
        />
      )}

      {satellites.map(({ icon: Icon, label, onClick, dx, dy, delay }) => (
        <button
          key={label}
          onClick={onClick}
          aria-label={label}
          className={`fixed z-50 h-12 w-12 rounded-full border border-border bg-card text-foreground shadow-lg flex items-center justify-center transition-all duration-200 ease-out ${
            open ? "pointer-events-auto opacity-100 scale-100" : "pointer-events-none opacity-0 scale-50"
          }`}
          style={{
            right: "calc(20px - 0px)",
            bottom: "calc(80px + env(safe-area-inset-bottom))",
            transform: open ? `translate(${dx}px, ${dy}px)` : "translate(0,0)",
            transitionDelay: open ? `${delay}ms` : "0ms",
          }}
        >
          <Icon size={18} className="text-primary" />
        </button>
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close log menu" : "Log meal"}
        aria-expanded={open}
        className="fixed right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:shadow-xl active:scale-95"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        <span
          className="transition-transform duration-200 ease-out"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <Plus size={26} strokeWidth={2.4} />
        </span>
      </button>
    </>
  );
}
