import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const APP_URL = "https://nutriaitracker.lovable.app";

// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    tab:    "Log by voice",
    badge:  "01 / 05 · Log by voice",
    img:    "/demo-screens/slide-01-voice.png",
  },
  {
    tab:    "Ask AI",
    badge:  "02 / 05 · Ask AI",
    img:    "/demo-screens/slide-02-askai.png",
  },
  {
    tab:    "Tracking",
    badge:  "03 / 05 · Tracking",
    img:    "/demo-screens/slide-03-tracking.png",
  },
  {
    tab:    "Alerts",
    badge:  "04 / 05 · Alerts",
    img:    "/demo-screens/slide-04-alerts.png",
  },
  {
    tab:    "Meal plan",
    badge:  "05 / 05 · Meal plan",
    img:    "/demo-screens/slide-05-mealplan.png",
  },
] as const;

const INTERVAL_MS = 5000;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  className?: string;
  onCreateAccount?: () => void;
  interval?: number;
}

export function NutriAIDemoPanel({ className, onCreateAccount, interval = INTERVAL_MS }: Props) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  const goTo = (idx: number) => {
    if (idx === current) return;
    setVisible(false);
    setTimeout(() => { setCurrent(idx); setVisible(true); }, 300);
  };

  // Auto-advance
  useEffect(() => {
    const t = setTimeout(() => goTo((current + 1) % SLIDES.length), interval);
    return () => clearTimeout(t);
  }, [current, interval]);

  const slide = SLIDES[current];

  return (
    <div
      className={cn("relative flex flex-col items-center overflow-hidden select-none", className)}
      style={{ background: "#070d07" }}
    >
      {/*
        Each slide IS the real screenshot of the landing page.
        We stack it in the centre, then float interactive elements on top.
        The screenshot already contains: dark bg, dot pattern, badge, title,
        phone mockup and the CTA + tab bar visuals — so pixel-perfect match.
      */}

      {/* Slide image — fills the container, centred */}
      <img
        key={current}
        src={slide.img}
        alt={slide.tab}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ minHeight: 0 }}
        draggable={false}
      />

      {/* Interactive CTA overlaid over the image's button area */}
      <a
        href={APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onCreateAccount}
        className="absolute inset-x-0 flex justify-center"
        /* Position over the yellow button — roughly 82% from top of the screenshot */
        style={{ bottom: "11%" }}
        aria-label="Create a free account on Nutri AI"
      >
        <span
          className="flex items-center gap-3 rounded-full px-7 py-3.5 font-semibold text-sm shadow-xl
                     transition-transform hover:scale-[1.03] active:scale-[0.98] opacity-0 w-full max-w-xs h-12"
          /* Fully transparent — the button visual is already in the screenshot.
             This invisible element sits on top to make it clickable. */
        />
      </a>

      {/* Interactive tab bar at the bottom — replaces the static one in the image */}
      <div
        className="absolute bottom-0 inset-x-0 flex items-center justify-around px-2 pb-1 pt-1"
        style={{ background: "rgba(7,13,7,0.85)", backdropFilter: "blur(6px)" }}
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.tab}
            onClick={() => goTo(i)}
            className={cn(
              "flex-1 text-center py-1.5 text-[10px] font-medium border-t-2 transition-all duration-200",
              i === current
                ? "text-[#d4a820] border-[#d4a820]"
                : "text-white/40 border-transparent hover:text-white/60"
            )}
          >
            {s.tab}
          </button>
        ))}
      </div>
    </div>
  );
}

export default NutriAIDemoPanel;
