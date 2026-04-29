import { useEffect, useState } from "react";

interface Floater {
  id: number;
  amount: number;
}

export function XPFloater() {
  const [items, setItems] = useState<Floater[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { amount: number };
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, amount: detail.amount }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 1600);
    };
    window.addEventListener("xp:awarded", handler as EventListener);
    return () => window.removeEventListener("xp:awarded", handler as EventListener);
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="xp-floater rounded-full px-4 py-2 text-sm font-semibold shadow-lg border"
          style={{
            backgroundColor: "#FFF8E1",
            borderColor: "#F0C24A",
            color: "#7A5800",
          }}
        >
          +{it.amount} XP ⭐
        </div>
      ))}
    </div>
  );
}
