import { Home, MessageSquarePlus, CalendarDays, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "today" | "log" | "plan" | "me";

const tabs: { key: TabKey; label: string; Icon: typeof Home }[] = [
  { key: "today", label: "Today",  Icon: Home },
  { key: "log",   label: "Nutri AI", Icon: MessageSquarePlus },
  { key: "plan",  label: "Plan",   Icon: CalendarDays },
  { key: "me",    label: "Me",     Icon: UserCircle },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
      style={{ ["--tabbar-h" as any]: "56px" }}
    >
      <div className="max-w-md mx-auto grid grid-cols-4 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={17} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[9px] tracking-wide leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

