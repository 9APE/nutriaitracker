import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { usePrefersReducedMotion } from "./showcase/hooks";
import { PHONE_H, PHONE_W } from "./showcase/PhoneMock";
import {
  ALERT_MS,
  ASK_AI_MS,
  AlertScene,
  AskAiScene,
  LOG_MEAL_MS,
  LogMealScene,
  PLAN_MS,
  PlanScene,
  TRACK_MS,
  TrackScene,
  type SceneProps,
} from "./showcase/scenes";

interface Slide {
  id: string;
  label: string;
  title: string;
  caption: string;
  ms: number;
  Scene: ComponentType<SceneProps>;
}

export const SLIDES: Slide[] = [
  { id: "log", label: "Log by voice", title: "Log a meal in seconds", caption: "Tap Log Meal, say what you ate, and NutriAI does the math.", ms: LOG_MEAL_MS, Scene: LogMealScene },
  { id: "ask", label: "Ask AI", title: "Ask for meals that fit your goals", caption: "Speak your question and get a personalised meal with the macros that matter.", ms: ASK_AI_MS, Scene: AskAiScene },
  { id: "track", label: "Tracking", title: "Calories and nutrients, live", caption: "Targets are calculated from your own health metrics, not a generic average.", ms: TRACK_MS, Scene: TrackScene },
  { id: "alerts", label: "Alerts", title: "Smart health alerts", caption: "Go over on sodium and NutriAI flags it, then suggests how to balance your day.", ms: ALERT_MS, Scene: AlertScene },
  { id: "plan", label: "Meal plan", title: "A week of meals, planned", caption: "Pick the days, generate, then click through each day of your plan.", ms: PLAN_MS, Scene: PlanScene },
];

interface Props {
  onTryFree: () => void;
  tryFreeBusy?: boolean;
}

export function AuthShowcase({ onTryFree, tryFreeBusy = false }: Props) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  // Auto-advance. With reduced motion each slide shows its end state and holds a bit longer.
  useEffect(() => {
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), reduced ? 6000 : slide.ms);
    return () => window.clearTimeout(id);
  }, [index, reduced, slide.ms]);

  // Scale the phone to whatever room the panel has.
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const s = Math.min(1, (r.height - 36) / (PHONE_H + 24), (r.width - 24) / (PHONE_W + 24));
      setScale(Math.max(0.5, s || 1));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 3D tilt that follows the pointer
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 10 });
  };

  const Scene = slide.Scene;
  const frameW = PHONE_W * scale + 24;
  const frameH = PHONE_H * scale + 24;

  return (
    <section
      className="relative isolate flex h-full min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "linear-gradient(135deg, #07140f 0%, #0d2a20 45%, #08161f 100%)" }}
      aria-label="NutriAI feature showcase"
    >
      <div className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-emerald-500/25 blur-[110px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-6 pt-8">
        {/* Caption */}
        <div className="max-w-xl text-center" aria-live="polite">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-200 backdrop-blur">
            <Sparkles size={12} /> {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")} · {slide.label}
          </div>
          <h2 key={slide.id + "t"} className="animate-in fade-in slide-in-from-bottom-2 text-3xl font-semibold tracking-tight duration-500">
            {slide.title}
          </h2>
          <p key={slide.id + "c"} className="mx-auto mt-1.5 max-w-md animate-in fade-in text-sm text-white/65 duration-700">
            {slide.caption}
          </p>
        </div>

        {/* Card stack */}
        <div ref={stageRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center" style={{ perspective: 1400 }} onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="absolute rounded-[48px] border border-white/10 bg-white/[0.04] backdrop-blur-sm" style={{ width: frameW, height: frameH, transform: "translate(52px, 14px) rotate(6deg) scale(0.94)" }} />
          <div className="absolute rounded-[48px] border border-white/10 bg-white/[0.06] backdrop-blur-sm" style={{ width: frameW, height: frameH, transform: "translate(-46px, 8px) rotate(-5deg) scale(0.96)" }} />
          <div
            className="relative rounded-[46px] border border-white/20 bg-white/10 p-3 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            style={{
              width: frameW,
              height: frameH,
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 250ms ease-out",
              transformStyle: "preserve-3d",
            }}
          >
            <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
              <div key={slide.id} className="animate-in fade-in zoom-in-95 duration-500" style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <Scene reduced={reduced} />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onTryFree}
          disabled={tryFreeBusy}
          className="group inline-flex h-12 items-center gap-2 rounded-full bg-emerald-400 px-8 text-sm font-semibold text-emerald-950 shadow-[0_10px_30px_-8px_rgba(52,211,153,0.7)] transition hover:scale-[1.03] hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-60"
        >
          {tryFreeBusy ? <Loader2 size={16} className="animate-spin" /> : null}
          Try for Free
          <span className="text-[11px] font-normal opacity-70">temporary preview, nothing saved</span>
        </button>

        {/* Progress */}
        <div className="flex w-full max-w-xl items-center gap-2" role="tablist" aria-label="Feature slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.label}
              onClick={() => setIndex(i)}
              className="group flex-1 text-left"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-white/15">
                <span
                  key={i === index ? `on-${index}` : `off-${i}`}
                  className="block h-full rounded-full bg-emerald-300"
                  style={
                    i < index
                      ? { width: "100%" }
                      : i === index
                        ? { width: reduced ? "100%" : undefined, animation: reduced ? undefined : `showcase-progress ${s.ms}ms linear forwards` }
                        : { width: 0 }
                  }
                />
              </span>
              <span className={`mt-1.5 hidden text-[10px] transition-colors xl:block ${i === index ? "text-white" : "text-white/45 group-hover:text-white/70"}`}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
