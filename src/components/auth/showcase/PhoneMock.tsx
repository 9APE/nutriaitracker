import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, Home, MessageSquarePlus, Settings, Flame, UserCircle } from "lucide-react";

export type TabId = "today" | "log" | "plan" | "me";

export const PHONE_W = 340;
export const PHONE_H = 640;

/* ---------- Fake cursor ---------- */

export interface CursorState {
  /** value of the data-t attribute of the element the cursor should move to */
  target: string | null;
  /** increments on every tap so the ripple replays */
  pulse: number;
}

/**
 * Phone-shaped viewport that renders a replica of the app at its natural size
 * (the parent scales it). The cursor measures real elements inside it, so
 * the clicks always land on the right button.
 */
export function PhoneFrame({ children, cursor }: { children: ReactNode; cursor: CursorState }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      if (!cursor.target) return;
      const el = root.querySelector<HTMLElement>(`[data-t="${cursor.target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const scale = rr.width / root.offsetWidth || 1;
      setPos({ x: (r.left - rr.left + r.width / 2) / scale, y: (r.top - rr.top + r.height / 2) / scale });
    };
    measure();
    // the target may appear a moment after the step starts
    const id = window.setTimeout(measure, 120);
    return () => window.clearTimeout(id);
  }, [cursor.target]);

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-[38px] border-[6px] border-neutral-900 bg-background text-foreground shadow-2xl"
      style={{ width: PHONE_W, height: PHONE_H }}
      aria-hidden
    >
      {children}
      <div
        className="pointer-events-none absolute left-0 top-0 z-50"
        style={{
          transform: `translate(${pos?.x ?? PHONE_W * 0.7}px, ${pos?.y ?? PHONE_H * 0.55}px)`,
          transition: "transform 750ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms",
          opacity: cursor.target ? 1 : 0,
        }}
      >
        <span key={cursor.pulse} className={cursor.pulse ? "showcase-ripple" : "hidden"} />
        <svg width="26" height="26" viewBox="0 0 24 24" className="-ml-1 -mt-1 drop-shadow-lg" key={`c${cursor.pulse}`} style={{ animation: cursor.pulse ? "showcase-press 260ms ease-out" : undefined }}>
          <path d="M5 3l14 8-6 2-2 6z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- App chrome ---------- */

export function AppHeader() {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <span className="text-[15px] font-semibold tracking-tight">Nutri AI</span>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="text-[10px] font-semibold text-foreground">GB</span>
        <Settings size={14} />
        <Bell size={14} />
      </div>
    </div>
  );
}

const TABS: { id: TabId; label: string; Icon: typeof Home }[] = [
  { id: "today", label: "Today", Icon: Home },
  { id: "log", label: "Nutri AI", Icon: MessageSquarePlus },
  { id: "plan", label: "Plan", Icon: CalendarDays },
  { id: "me", label: "Me", Icon: UserCircle },
];

export function TabBar({ active }: { active: TabId }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex h-[58px] items-center justify-around border-t border-border bg-background/95 pb-1 backdrop-blur">
      {TABS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <div key={id} data-t={`tab-${id}`} className={`flex w-16 flex-col items-center gap-0.5 ${on ? "text-primary" : "text-muted-foreground"}`}>
            <Icon size={19} />
            <span className="text-[9px] font-medium">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StreakPill({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium shadow-sm">
      <Flame size={12} className={days ? "text-amber-500" : "text-muted-foreground"} />
      <span className="font-mono-data">{days}</span> {days === 1 ? "day" : "days"}
    </div>
  );
}

export function WeekStrip({ active = 3 }: { active?: number }) {
  return (
    <div className="flex justify-between">
      {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
        <span
          key={i}
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-medium ${
            i === active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
          }`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** Half-circle calorie gauge, same look as the Today screen. */
export function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const R = 78;
  const arc = Math.PI * R * 1.5; // 270 degrees
  const pct = Math.min(1, goal ? consumed / goal : 0);
  const left = Math.max(0, goal - consumed);
  return (
    <div className="relative mx-auto h-[150px] w-[190px]">
      <svg viewBox="0 0 200 170" className="absolute inset-0 h-full w-full">
        <g transform="rotate(135 100 100)">
          <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} 999`} />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arc * pct} 999`}
            style={{ transition: "stroke-dasharray 120ms linear" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span className="font-mono-data text-[30px] font-bold leading-none tabular-nums">{left.toLocaleString("en-US")}</span>
        <span className="mt-1 text-[10px] text-muted-foreground">kcal left</span>
      </div>
    </div>
  );
}

export function StatRow({ consumed, goal, burned = 0 }: { consumed: number; goal: number; burned?: number }) {
  const cell = "flex-1 text-center";
  return (
    <div className="flex items-center divide-x divide-border text-[9px] uppercase tracking-wide text-muted-foreground">
      <div className={cell}>
        <div className="font-mono-data text-[15px] font-bold normal-case tabular-nums text-primary">{consumed.toLocaleString("en-US")}</div>
        Consumed
      </div>
      <div className={cell}>
        <div className="font-mono-data text-[15px] font-bold normal-case tabular-nums text-foreground">{goal.toLocaleString("en-US")}</div>
        Goal
      </div>
      <div className={cell}>
        <div className="font-mono-data text-[15px] font-bold normal-case tabular-nums text-amber-600">{burned}</div>
        Burned
      </div>
    </div>
  );
}

export function MacroCard({ label, value, goal, color, unit = "g", over = false }: { label: string; value: number; goal: number; color: string; unit?: string; over?: boolean }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  const c = over ? "hsl(var(--destructive))" : color;
  return (
    <div className={`rounded-xl border p-2 ${over ? "border-destructive/30 bg-destructive/10" : "border-border bg-card"}`}>
      <div className="font-mono-data text-[13px] font-bold tabular-nums" style={{ color: c }}>
        {value.toLocaleString("en-US")} <span className="text-[9px] font-normal text-muted-foreground">/{goal.toLocaleString("en-US")}{unit}</span>
      </div>
      <div className="mt-0.5 text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c, transition: "width 120ms linear" }} />
      </div>
      {over && <div className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-destructive">Over limit</div>}
    </div>
  );
}

/** Animated voice waveform. */
export function Waveform({ active, bars = 22, className = "" }: { active: boolean; bars?: number; className?: string }) {
  return (
    <div className={`flex h-10 items-center justify-center gap-[3px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-primary"
          style={{
            height: active ? undefined : 4,
            animation: active ? `showcase-wave ${700 + ((i * 97) % 500)}ms ease-in-out ${(i * 53) % 400}ms infinite alternate` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function Toast({ show, children, tone = "success" }: { show: boolean; children: ReactNode; tone?: "success" | "warning" }) {
  return (
    <div
      className={`absolute inset-x-3 top-14 z-40 rounded-xl border px-3 py-2 text-[11px] font-medium shadow-lg transition-all duration-500 ${
        tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-primary/30 bg-card text-foreground"
      } ${show ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}
    >
      {children}
    </div>
  );
}

export function Bubble({ role, children, show = true }: { role: "user" | "ai"; children: ReactNode; show?: boolean }) {
  return (
    <div className={`flex transition-all duration-500 ${role === "user" ? "justify-end" : "justify-start"} ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-[11.5px] leading-snug ${
          role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
