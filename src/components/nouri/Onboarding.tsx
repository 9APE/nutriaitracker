import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_GOALS, type Goals, storage } from "@/lib/nouri-storage";

const messages = [
  "Hi there! I'm Nouri, your personal nutrition assistant. 👋",
  "Tracking what you eat is simple — just describe what you had and I'll calculate all the calories and macros automatically.",
  "For the most accurate results, be specific with quantities. Instead of saying 'I had chicken and rice', try: 'This morning I had 100g of jasmine rice, 150g of grilled chicken breast, and two handfuls of mixed vegetables with olive oil.' The more detail you give, the more accurate the numbers.",
  "Let's set your daily goals before we start.",
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-surface border border-border rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<number>(0);
  const [typing, setTyping] = useState<boolean>(true);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown >= messages.length) {
      setTyping(false);
      return;
    }
    setTyping(true);
    const t1 = setTimeout(() => {
      setTyping(false);
      setShown((s) => s + 1);
    }, shown === 0 ? 700 : 1500);
    return () => clearTimeout(t1);
  }, [shown]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  const allShown = shown >= messages.length;

  const handleStart = () => {
    storage.setGoals(goals);
    storage.setOnboarded(true);
    onDone();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-serif text-lg font-medium">Nouri</span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {messages.slice(0, shown).map((m, i) => (
            <div key={i} className="flex items-start gap-2 animate-bubble-in">
              <div className="text-xl shrink-0 pt-1">🌿</div>
              <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed text-foreground max-w-[85%]">
                {m}
              </div>
            </div>
          ))}
          {typing && shown < messages.length && (
            <div className="flex items-start gap-2">
              <div className="text-xl shrink-0 pt-1">🌿</div>
              <TypingDots />
            </div>
          )}

          {allShown && (
            <div className="mt-6 nouri-card p-5 animate-bubble-in space-y-5">
              <h2 className="font-serif text-lg font-medium">Your daily goals</h2>

              <GoalSlider
                label="Calories"
                value={goals.calories}
                min={1200}
                max={4000}
                step={50}
                unit="kcal"
                onChange={(v) => setGoals({ ...goals, calories: v })}
              />
              <GoalSlider
                label="Protein 💪"
                value={goals.protein}
                min={40}
                max={300}
                step={5}
                unit="g"
                onChange={(v) => setGoals({ ...goals, protein: v })}
              />
              <GoalSlider
                label="Carbs 🌾"
                value={goals.carbs}
                min={50}
                max={500}
                step={5}
                unit="g"
                onChange={(v) => setGoals({ ...goals, carbs: v })}
              />
              <GoalSlider
                label="Fat 🫒"
                value={goals.fat}
                min={20}
                max={200}
                step={2}
                unit="g"
                onChange={(v) => setGoals({ ...goals, fat: v })}
              />

              <Button onClick={handleStart} className="w-full h-12 text-base mt-2">
                Start Tracking 🌿
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm">{label}</span>
        <span className="font-mono-data text-sm text-foreground">
          {value}
          <span className="text-muted-foreground ml-0.5">{unit}</span>
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
