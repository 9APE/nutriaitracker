import { Home, Mic, ClipboardList, BarChart3, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, t } from "@/lib/nouri-i18n";

export type TabKey = "today" | "log" | "ask" | "history" | "insights";

const tabs: { key: TabKey; label: string; Icon: typeof Home; highlight?: boolean }[] = [
  { key: "today",    label: "Today",    Icon: Home },
  { key: "log",      label: "Log Meal", Icon: Mic },
  { key: "ask",      label: "Ask AI",   Icon: MessageCircle, highlight: true },
  { key: "history",  label: "History",  Icon: ClipboardList },
  { key: "insights", label: "Insights", Icon: BarChart3 },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-5 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ key, label, Icon, highlight }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors",
                isActive
                  ? "text-primary"
                  : highlight
                  ? "text-primary/60 hover:text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {highlight ? (
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors -mt-5 shadow-lg border",
                    isActive
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-primary",
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                </div>
              ) : (
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              )}
              <span className="text-[10px] tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
