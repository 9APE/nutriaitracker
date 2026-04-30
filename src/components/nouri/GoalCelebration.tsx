import { useEffect, useMemo, useState } from "react";
import { getXPEarnedToday } from "@/lib/nouri-xp";

interface Confetto {
  id: number;
  left: number;       // %
  delay: number;      // s
  duration: number;   // s
  color: string;
  rotate: number;
  size: number;
}

const COLORS = ["#5BB882", "#F0C24A", "#5B8FCC", "#E26D5C", "#9B6BCC", "#48C2A3"];

function makeConfetti(n = 80): Confetto[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.4 + Math.random() * 0.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 6,
  }));
}

function playChime() {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0 },     // C5
      { f: 659.25, t: 0.12 },  // E5
      { f: 783.99, t: 0.24 },  // G5
      { f: 1046.5, t: 0.36 },  // C6
    ];
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(1, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.45);
      osc.connect(g).connect(master);
      osc.start(now + t);
      osc.stop(now + t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* ignore */
  }
}

function readUserName(): string {
  try {
    const raw = localStorage.getItem("userProfile");
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.name && typeof p.name === "string") return p.name;
    }
  } catch {}
  return "friend";
}

export function GoalCelebration() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("friend");
  const [xpToday, setXpToday] = useState(0);

  useEffect(() => {
    const onHit = () => {
      setName(readUserName());
      setXpToday(getXPEarnedToday());
      setShow(true);
      playChime();
      window.setTimeout(() => setShow(false), 2000);
    };
    window.addEventListener("goals:all-hit", onHit as EventListener);
    return () => window.removeEventListener("goals:all-hit", onHit as EventListener);
  }, []);

  const confetti = useMemo(() => (show ? makeConfetti(90) : []), [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {confetti.map((c) => (
        <span
          key={c.id}
          className="celebration-confetto"
          style={{
            left: `${c.left}%`,
            backgroundColor: c.color,
            width: c.size,
            height: c.size * 0.4,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            // @ts-expect-error custom prop
            "--rot": `${c.rotate}deg`,
          }}
        />
      ))}

      <div className="absolute inset-0 flex items-start justify-center pt-24">
        <div
          className="celebration-card rounded-2xl border-2 px-5 py-4 shadow-lg max-w-[90vw] text-center"
          style={{
            backgroundColor: "#FFF8E1",
            borderColor: "#F0C24A",
            color: "#7A5800",
          }}
        >
          <div className="text-2xl font-medium">All goals hit, {name}</div>
          {xpToday > 0 && (
            <div className="font-mono-data text-sm mt-1 opacity-80">
              +{xpToday} XP earned today ⭐
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
