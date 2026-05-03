import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FamilyMember } from "@/lib/family-utils";

interface Props {
  existingMember?: FamilyMember;
  onDone: (member: FamilyMember) => void;
  onClose: () => void;
}

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
}

const QUESTIONS = [
  { key: "name", q: "What's their name?", type: "text" },
  { key: "age", q: "How old are they?", type: "number" },
  { key: "sex", q: "Biological sex?", type: "chips", options: ["Male", "Female"] },
  { key: "height", q: "What's their height? (e.g., 170cm or 5'7\")", type: "text" },
  { key: "weight", q: "What's their weight? (e.g., 70kg or 154lbs)", type: "text" },
  { key: "goals", q: "What are their main health goals?", type: "chips", options: ["Lose weight", "Gain muscle", "Maintain", "Eat healthier", "Manage condition"] },
  { key: "conditions", q: "Any health conditions?", type: "chips", multi: true, options: ["None", "Diabetes", "Hypertension", "Celiac Disease", "Crohn's Disease", "Kidney Disease", "High Cholesterol", "Endometriosis", "Thyroid conditions", "PCOS", "Heart Disease"] },
  { key: "restrictions", q: "Any dietary restrictions?", type: "chips", multi: true, options: ["None", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Halal", "Kosher", "Pescatarian"] },
  { key: "allergies", q: "Any food allergies?", type: "chips", multi: true, options: ["None", "Nuts", "Peanuts", "Shellfish", "Fish", "Eggs", "Soy", "Wheat", "Milk"] },
  { key: "activityLevel", q: "Activity level?", type: "chips", options: ["Sedentary", "Lightly active", "Moderately active", "Very active"] },
  { key: "dislikes", q: "Any foods they dislike? (comma-separated, or 'None')", type: "text" },
] as const;

function parseWeightToKg(w: string): number | null {
  const num = parseFloat(w?.replace(/[^0-9.]/g, "") ?? "");
  if (!isFinite(num)) return null;
  if (/lb/i.test(w)) return Math.round(num * 0.453592);
  return Math.round(num);
}

function parseHeightToCm(h: string): number | null {
  const ftMatch = h.match(/(\d+)\s*[''′]\s*(\d+)/);
  if (ftMatch) return Math.round(parseInt(ftMatch[1]) * 30.48 + parseInt(ftMatch[2]) * 2.54);
  const num = parseFloat(h?.replace(/[^0-9.]/g, "") ?? "");
  return isFinite(num) ? Math.round(num) : null;
}

/** Simple Mifflin-St Jeor calculation for daily targets */
function calculateTargets(data: Record<string, any>): FamilyMember["dailyTargets"] {
  const age = parseInt(data.age) || 30;
  const weightKg = parseWeightToKg(data.weight || "70kg") || 70;
  const heightCm = parseHeightToCm(data.height || "170cm") || 170;
  const sex = data.sex || "Male";

  // Mifflin-St Jeor BMR
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  bmr += sex === "Male" ? 5 : -161;

  const activityMultipliers: Record<string, number> = {
    "Sedentary": 1.2,
    "Lightly active": 1.375,
    "Moderately active": 1.55,
    "Very active": 1.725,
  };
  const tdee = bmr * (activityMultipliers[data.activityLevel] || 1.375);

  // Adjust for goals
  let calories = Math.round(tdee);
  const goal = data.goals || "Maintain";
  if (goal === "Lose weight") calories = Math.round(tdee * 0.8);
  else if (goal === "Gain muscle") calories = Math.round(tdee * 1.1);

  // Child adjustments (age < 12)
  if (age < 6) calories = Math.min(calories, 1200);
  else if (age < 12) calories = Math.min(calories, 1800);

  const protein = Math.round(weightKg * (goal === "Gain muscle" ? 2.0 : 1.4));
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat };
}

export function FamilyMemberOnboarding({ existingMember, onDone, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    if (!existingMember) return {};
    return {
      name: existingMember.name,
      age: existingMember.age?.toString() || "",
      sex: existingMember.sex || "",
      height: existingMember.height || "",
      weight: existingMember.weight || "",
      goals: existingMember.goals || "",
      conditions: existingMember.conditions?.length ? existingMember.conditions : [],
      restrictions: existingMember.restrictions?.length ? existingMember.restrictions : [],
      allergies: existingMember.allergies?.length ? existingMember.allergies : [],
      activityLevel: existingMember.activityLevel || "",
      dislikes: existingMember.dislikes?.join(", ") || "",
    };
  });
  const [input, setInput] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentQ = step < QUESTIONS.length ? QUESTIONS[step] : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [step]);

  const handleAnswer = (value: string | string[]) => {
    const key = currentQ!.key;
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setInput("");
    setMultiSelected([]);

    if (step + 1 >= QUESTIONS.length) {
      // All questions answered — build member
      const finalAnswers = { ...answers, [key]: value };
      const targets = calculateTargets(finalAnswers);
      const member: FamilyMember = {
        id: existingMember?.id || crypto.randomUUID(),
        name: finalAnswers.name || "Family member",
        age: parseInt(finalAnswers.age) || undefined,
        sex: finalAnswers.sex || undefined,
        height: finalAnswers.height || undefined,
        weight: finalAnswers.weight || undefined,
        restrictions: Array.isArray(finalAnswers.restrictions)
          ? finalAnswers.restrictions.filter((r: string) => r !== "None")
          : [],
        conditions: Array.isArray(finalAnswers.conditions)
          ? finalAnswers.conditions.filter((c: string) => c !== "None")
          : [],
        allergies: Array.isArray(finalAnswers.allergies)
          ? finalAnswers.allergies.filter((a: string) => a !== "None")
          : [],
        dislikes: typeof finalAnswers.dislikes === "string"
          ? finalAnswers.dislikes.split(",").map((d: string) => d.trim()).filter(Boolean).filter((d: string) => d.toLowerCase() !== "none")
          : [],
        activityLevel: finalAnswers.activityLevel || undefined,
        goals: finalAnswers.goals || undefined,
        dailyTargets: targets,
      };
      onDone(member);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleChipToggle = (option: string, multi: boolean) => {
    if (!multi) {
      handleAnswer(option);
      return;
    }
    if (option === "None") {
      handleAnswer(["None"]);
      return;
    }
    setMultiSelected((prev) => {
      const next = prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev.filter((o) => o !== "None"), option];
      return next;
    });
  };

  // Build chat messages from previous answers
  const chatMessages: ChatMsg[] = [];
  for (let i = 0; i <= step && i < QUESTIONS.length; i++) {
    chatMessages.push({ role: "assistant", content: QUESTIONS[i].q });
    if (i < step) {
      const val = answers[QUESTIONS[i].key];
      chatMessages.push({ role: "user", content: Array.isArray(val) ? val.join(", ") : String(val) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-serif text-base font-medium">
          {existingMember ? `Edit ${existingMember.name}` : "Add family member"}
        </span>
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              msg.role === "assistant"
                ? "bg-card border border-border rounded-tl-sm self-start"
                : "bg-primary text-primary-foreground rounded-br-sm ml-auto"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {currentQ && (
        <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {currentQ.type === "chips" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleChipToggle(opt, !!(currentQ as any).multi)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      multiSelected.includes(opt)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {(currentQ as any).multi && multiSelected.length > 0 && (
                <button
                  onClick={() => handleAnswer(multiSelected)}
                  className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                >
                  Continue ({multiSelected.length} selected)
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) handleAnswer(input.trim());
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50"
                type={currentQ.type === "number" ? "number" : "text"}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
