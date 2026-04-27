import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_GOALS, type Goals } from "@/lib/nouri-storage";
import { Loader2 } from "lucide-react";

const messages = [
  "Hi there! I'm Nouri, your personal nutrition assistant. 🌿",
  "Tracking what you eat is simple — just describe what you had and I'll calculate all the calories and macros automatically.",
  "For the most accurate results, be specific with quantities. Instead of 'I had chicken and rice', try: '100g of jasmine rice, 150g of grilled chicken breast, two handfuls of mixed vegetables with olive oil.'",
  "Before we start — tell me a little about you so I can personalise your plan.",
];

export interface BodyStats {
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  activity_level?: string;
}

interface OnboardingProps {
  initialGoals?: Goals;
  initialStats?: BodyStats;
  onDone: (data: { goals: Goals; stats: BodyStats }) => Promise<void> | void;
}

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { id: "light", label: "Lightly active", desc: "1–3 workouts / week" },
  { id: "moderate", label: "Moderately active", desc: "3–5 workouts / week" },
  { id: "active", label: "Very active", desc: "6+ workouts / week" },
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

export function Onboarding({ initialGoals, initialStats, onDone }: OnboardingProps) {
  const [shown, setShown] = useState<number>(0);
  const [typing, setTyping] = useState<boolean>(true);
  const [goals, setGoals] = useState<Goals>(initialGoals ?? DEFAULT_GOALS);
  const [stats, setStats] = useState<BodyStats>(initialStats ?? {});
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown >= messages.length) {
      setTyping(false);
      return;
    }
    setTyping(true);
    const t1 = setTimeout(
      () => {
        setTyping(false);
        setShown((s) => s + 1);
      },
      shown === 0 ? 700 : 1500
    );
    return () => clearTimeout(t1);
  }, [shown]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  const allShown = shown >= messages.length;

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await onDone({ goals, stats });
    } finally {
      setSubmitting(false);
    }
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
            <>
              <div className="mt-6 nouri-card p-5 animate-bubble-in space-y-4">
                <h2 className="font-serif text-lg font-medium">About you</h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Optional — used to fine-tune meal suggestions.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <NumberField
                    label="Age"
                    unit="yrs"
                    value={stats.age}
                    onChange={(v) => setStats({ ...stats, age: v })}
                    min={10}
                    max={100}
                  />
                  <NumberField
                    label="Weight"
                    unit="kg"
                    value={stats.weight_kg}
                    onChange={(v) => setStats({ ...stats, weight_kg: v })}
                    min={30}
                    max={250}
                  />
                  <NumberField
                    label="Height"
                    unit="cm"
                    value={stats.height_cm}
                    onChange={(v) => setStats({ ...stats, height_cm: v })}
                    min={120}
                    max={230}
                  />
                </div>

                <div>
                  <Label className="text-sm">Activity level</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {ACTIVITY_LEVELS.map((a) => {
                      const selected = stats.activity_level === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setStats({ ...stats, activity_level: a.id })}
                          className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className="text-sm font-medium">{a.label}</div>
                          <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 nouri-card p-5 animate-bubble-in space-y-5">
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

                <Button
                  onClick={handleStart}
                  disabled={submitting}
                  className="w-full h-12 text-base mt-2"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Start Tracking 🌿"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  unit: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">
        {label} <span className="text-muted-foreground/70">({unit})</span>
      </Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? undefined : Number(e.target.value);
          onChange(Number.isFinite(n!) ? n : undefined);
        }}
        min={min}
        max={max}
        className="mt-1 font-mono-data"
        placeholder="—"
      />
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
