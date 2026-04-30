import { useEffect, useState } from "react";
import type { Meal } from "@/lib/nouri-storage";
import { todayISO } from "@/lib/nouri-storage";
import { loadUserProfile } from "@/components/nouri/ProfileChatOnboarding";

const DISMISS_KEY = "nudgeDismissedDate";

interface EveningNudgeProps {
  meals: Meal[];
  onGoLog: () => void;
}

export function EveningNudge({ meals, onGoLog }: EveningNudgeProps) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const profile = loadUserProfile();
    setName(profile?.name?.split(" ")[0] || "friend");

    const compute = () => {
      const today = todayISO();
      const now = new Date();
      const afterEight = now.getHours() >= 20;
      const dismissed = localStorage.getItem(DISMISS_KEY) === today;

      const todayMeals = meals.filter((m) => m.date === today);
      const latest = todayMeals.reduce(
        (max, m) => (m.created_at > max ? m.created_at : max),
        0
      );
      let lastBeforeFive = true;
      if (latest > 0) {
        const d = new Date(latest);
        lastBeforeFive = d.getHours() < 17;
      }

      setVisible(afterEight && lastBeforeFive && !dismissed);
    };

    compute();
    const id = window.setInterval(compute, 60_000);
    return () => window.clearInterval(id);
  }, [meals]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, todayISO());
    setVisible(false);
  };

  return (
    <div
      className="rounded-2xl border p-4 flex gap-3"
      style={{ backgroundColor: "#F4EFE6", borderColor: "#C9B68A" }}
      role="status"
    >
      <span className="text-2xl shrink-0">🌿</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "#5A4422" }}>
          Hey {name}, I haven't heard from you since this afternoon 🌿 How's
          dinner going? Don't forget your 🔥 streak!
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              dismiss();
              onGoLog();
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-full text-white transition-transform active:scale-95"
            style={{ backgroundColor: "#5BB882" }}
          >
            Log dinner now
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-medium px-3 py-1.5 rounded-full border transition-transform active:scale-95"
            style={{ borderColor: "#C9B68A", color: "#5A4422" }}
          >
            I'll do it later
          </button>
        </div>
      </div>
    </div>
  );
}
