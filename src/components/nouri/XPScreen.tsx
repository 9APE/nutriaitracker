import { X } from "lucide-react";
import { getTotalXP, getLevelInfo, XP_SOURCES } from "@/lib/nouri-xp";

interface Props {
  onClose: () => void;
}

export function XPScreen({ onClose }: Props) {
  const xp = getTotalXP();
  const info = getLevelInfo(xp);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto animate-bubble-in">
      <header className="px-5 py-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <span className="font-serif text-lg font-medium">Your XP</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto space-y-6">
          <section
            className="rounded-2xl border p-6 text-center"
            style={{ backgroundColor: "#FFF8E1", borderColor: "#F0C24A", color: "#7A5800" }}
          >
            <div className="text-xs uppercase tracking-wider opacity-70">Level</div>
            <div className="font-serif text-5xl font-medium mt-1">Lvl {info.level} ⭐</div>
            <div className="font-mono-data text-sm mt-2 opacity-80">{xp} XP total</div>
          </section>

          <section className="nouri-card p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">Progress to Lvl {info.level + 1}</span>
              <span className="font-mono-data text-xs text-muted-foreground">
                {info.xpIntoLevel} / {info.xpForLevel} XP
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full macro-fill"
                style={{ width: `${info.pct}%`, backgroundColor: "#F0C24A" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {info.xpToNext} XP to next level
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium px-1">How to earn XP</h2>
            <ul className="space-y-2">
              {XP_SOURCES.map((s) => (
                <li
                  key={s.id}
                  className="nouri-card p-4 flex items-start gap-3"
                >
                  <div className="text-2xl shrink-0">{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                      <span
                        className="font-mono-data text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: "#FFF8E1", color: "#7A5800", border: "1px solid #F0C24A" }}
                      >
                        +{s.amount} XP
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
