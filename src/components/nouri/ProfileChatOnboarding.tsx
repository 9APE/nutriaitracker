import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X } from "lucide-react";

export interface UserProfile {
  goals: string;
  healthConditions: string;
  dietaryRestrictions: string;
  activityLevel: string;
  regularFoods: string;
  dislikedFoods: string;
}

const PROFILE_KEY = "userProfile";

type Step = {
  key: keyof UserProfile;
  question: string;
  options?: { id: string; label: string; desc: string }[];
};

const STEPS: Step[] = [
  {
    key: "goals",
    question:
      "What are your main health or fitness goals? For example: lose weight, build muscle, improve energy, manage a condition.",
  },
  {
    key: "healthConditions",
    question:
      "Do you have any medical conditions I should know about? For example: diabetes, high blood pressure, celiac disease, or anything else.",
  },
  {
    key: "dietaryRestrictions",
    question:
      "Any dietary restrictions or preferences? For example: vegetarian, vegan, no gluten, no dairy, halal, kosher.",
  },
  {
    key: "activityLevel",
    question:
      "How active are you? Choose one below.",
    options: [
      { id: "Sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
      { id: "Lightly active", label: "Lightly active", desc: "1–3 workouts/week" },
      { id: "Moderately active", label: "Moderately active", desc: "4–5 workouts/week" },
      { id: "Very active", label: "Very active", desc: "Intense daily training" },
    ],
  },
  {
    key: "regularFoods",
    question:
      "What are some foods you eat regularly? List as many as you like — this helps me give accurate estimates.",
  },
  {
    key: "dislikedFoods",
    question: "Any foods you strongly dislike or never eat?",
  },
];

type ChatMessage =
  | { role: "nouri"; text: string }
  | { role: "user"; text: string };

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

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUserProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

interface Props {
  initial?: UserProfile | null;
  onDone: (profile: UserProfile) => void;
  onClose?: () => void; // shown only when editing (not first-launch)
}

export function ProfileChatOnboarding({ initial, onDone, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "nouri", text: "Hi! I'm Nouri 🌿 — let's set up your profile so I can personalise everything for you." },
  ]);
  const [stepIdx, setStepIdx] = useState(-1); // -1 = intro, then 0..STEPS.length, then done
  const [typing, setTyping] = useState(true);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Partial<UserProfile>>(initial ?? {});
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Push the next Nouri question whenever stepIdx changes
  useEffect(() => {
    if (done) return;
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      if (stepIdx === -1) {
        setStepIdx(0);
        return;
      }
      if (stepIdx < STEPS.length) {
        setMessages((m) => [...m, { role: "nouri", text: STEPS[stepIdx].question }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "nouri",
            text: "Perfect! I've got everything I need to personalize your experience. Let's get started! 🌿",
          },
        ]);
        setDone(true);
      }
    }, stepIdx === -1 ? 600 : 900);
    return () => clearTimeout(t);
  }, [stepIdx, done]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // When fully done, persist & finish after short delay
  useEffect(() => {
    if (!done) return;
    const profile: UserProfile = {
      goals: answers.goals ?? "",
      healthConditions: answers.healthConditions ?? "",
      dietaryRestrictions: answers.dietaryRestrictions ?? "",
      activityLevel: answers.activityLevel ?? "",
      regularFoods: answers.regularFoods ?? "",
      dislikedFoods: answers.dislikedFoods ?? "",
    };
    saveUserProfile(profile);
    const t = setTimeout(() => onDone(profile), 1400);
    return () => clearTimeout(t);
  }, [done]);

  const submitAnswer = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || stepIdx < 0 || stepIdx >= STEPS.length) return;
    const step = STEPS[stepIdx];
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setAnswers((a) => ({ ...a, [step.key]: trimmed }));
    setInput("");
    setStepIdx((i) => i + 1);
  };

  const currentStep = stepIdx >= 0 && stepIdx < STEPS.length ? STEPS[stepIdx] : null;
  const awaitingInput = !typing && currentStep && !done;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-serif text-lg font-medium">Nouri</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {messages.map((m, i) =>
            m.role === "nouri" ? (
              <div key={i} className="flex items-start gap-2 animate-bubble-in">
                <div className="text-xl shrink-0 pt-1">🌿</div>
                <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed text-foreground max-w-[85%]">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end animate-bubble-in">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] leading-relaxed max-w-[85%]">
                  {m.text}
                </div>
              </div>
            )
          )}
          {typing && (
            <div className="flex items-start gap-2">
              <div className="text-xl shrink-0 pt-1">🌿</div>
              <TypingDots />
            </div>
          )}

          {awaitingInput && currentStep?.options && (
            <div className="grid grid-cols-1 gap-2 pt-2 animate-bubble-in">
              {currentStep.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => submitAnswer(o.id)}
                  className="text-left rounded-xl border border-border bg-card hover:border-primary/50 px-4 py-3 transition-colors"
                >
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {awaitingInput && !currentStep?.options && (
        <div className="border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer(input);
            }}
            className="max-w-md mx-auto flex items-center gap-2"
          >
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
