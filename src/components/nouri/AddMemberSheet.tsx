import { useState } from "react";
import { X, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFamilyMembers, saveFamilyMembers, type FamilyMember } from "@/lib/family-utils";
import { toast } from "sonner";

const RESTRICTION_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Halal", "Kosher",
  "Nut-Free", "Low-Carb", "Low-Fat", "Low-Sodium", "Paleo", "Keto",
];

const CONDITION_OPTIONS = [
  "Type 2 Diabetes", "Type 1 Diabetes", "Hypertension", "High Cholesterol",
  "Celiac Disease", "Crohn's Disease", "Ulcerative Colitis", "IBS",
  "Kidney Disease", "Heart Disease", "Osteoporosis", "PCOS",
  "Endometriosis", "Hypothyroidism", "Hyperthyroidism", "Iron Deficiency Anaemia",
  "Obesity", "Pregnancy",
];

const ALLERGY_OPTIONS = [
  "Peanuts", "Tree Nuts", "Milk", "Eggs", "Wheat", "Soy",
  "Fish", "Shellfish", "Sesame",
];

type Step = "name" | "age" | "sex" | "restrictions" | "conditions" | "allergies";
const STEPS: Step[] = ["name", "age", "sex", "restrictions", "conditions", "allergies"];

interface Props {
  onClose: () => void;
  editMember?: FamilyMember;
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {active && <Check size={10} className="inline mr-1" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function AddMemberSheet({ onClose, editMember }: Props) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(editMember?.name ?? "");
  const [age, setAge] = useState(editMember?.age ? String(editMember.age) : "");
  const [sex, setSex] = useState(editMember?.sex ?? "");
  const [restrictions, setRestrictions] = useState<string[]>(editMember?.restrictions ?? []);
  const [conditions, setConditions] = useState<string[]>(editMember?.conditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(editMember?.allergies ?? []);

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const stepIdx = STEPS.indexOf(step);

  const canNext = () => {
    if (step === "name") return name.trim().length > 0;
    if (step === "age") return true; // optional
    if (step === "sex") return true; // optional
    return true;
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) {
      setStep(STEPS[stepIdx + 1]);
    } else {
      save();
    }
  };

  const save = () => {
    const members = getFamilyMembers();
    const member: FamilyMember = {
      id: editMember?.id ?? crypto.randomUUID(),
      name: name.trim(),
      age: age ? parseInt(age, 10) : undefined,
      sex: sex || undefined,
      restrictions,
      conditions,
      allergies,
      dislikes: editMember?.dislikes ?? [],
    };
    if (editMember) {
      const idx = members.findIndex((m) => m.id === editMember.id);
      if (idx !== -1) members[idx] = member;
      else members.push(member);
    } else {
      members.push(member);
    }
    saveFamilyMembers(members);
    toast.success(`${member.name} saved to your household`);
    onClose();
  };

  const STEP_CONFIG: Record<Step, { title: string; subtitle: string; content: React.ReactNode }> = {
    name: {
      title: "What's their name?",
      subtitle: "First name or nickname is fine.",
      content: (
        <input
          autoFocus
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
          placeholder="e.g. Sarah"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canNext() && next()}
        />
      ),
    },
    age: {
      title: "How old are they?",
      subtitle: "Optional — helps personalise recommendations.",
      content: (
        <input
          autoFocus
          type="number"
          min={1}
          max={120}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
          placeholder="e.g. 8"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && next()}
        />
      ),
    },
    sex: {
      title: "Their biological sex?",
      subtitle: "Optional — used for nutrition targets.",
      content: (
        <div className="flex gap-3">
          {["Female", "Male", "Other"].map((s) => (
            <button
              key={s}
              onClick={() => setSex(s === sex ? "" : s)}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-medium transition-colors",
                sex === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ),
    },
    restrictions: {
      title: "Dietary restrictions?",
      subtitle: "Select all that apply. Skip if none.",
      content: (
        <ChipGroup
          options={RESTRICTION_OPTIONS}
          selected={restrictions}
          onToggle={(v) => toggleItem(restrictions, setRestrictions, v)}
        />
      ),
    },
    conditions: {
      title: "Health conditions?",
      subtitle: "Used to tailor meal suggestions.",
      content: (
        <ChipGroup
          options={CONDITION_OPTIONS}
          selected={conditions}
          onToggle={(v) => toggleItem(conditions, setConditions, v)}
        />
      ),
    },
    allergies: {
      title: "Food allergies?",
      subtitle: "These ingredients will never be recommended.",
      content: (
        <ChipGroup
          options={ALLERGY_OPTIONS}
          selected={allergies}
          onToggle={(v) => toggleItem(allergies, setAllergies, v)}
        />
      ),
    },
  };

  const { title, subtitle, content } = STEP_CONFIG[step];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="sticky top-0 px-5 py-4 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {editMember ? "Edit member" : "Add family member"} · {stepIdx + 1}/{STEPS.length}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={20} />
          </button>
        </div>
        {/* Progress bar */}
        <div className="max-w-md mx-auto mt-3 h-1 bg-muted rounded-full">
          <div
            className="h-1 bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex-1 px-5 py-8 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h2 className="font-serif text-2xl font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          {content}
        </div>
      </div>

      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 border-t border-border">
        <div className="max-w-md mx-auto flex gap-3">
          {stepIdx > 0 && (
            <button
              onClick={() => setStep(STEPS[stepIdx - 1])}
              className="px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!canNext()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {isLast ? "Save member" : "Next"}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
