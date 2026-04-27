import { Home, Mic, ClipboardList, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "today" | "log" | "history" | "insights";

const tabs: { key: TabKey; label: string; Icon: typeof Home }[] = [
  { key: "today", label: "Today", Icon: Home },
  { key: "log", label: "Log", Icon: Mic },
  { key: "history", label: "History", Icon: ClipboardList },
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
      <div className="max-w-md mx-auto grid grid-cols-4 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[11px] tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
