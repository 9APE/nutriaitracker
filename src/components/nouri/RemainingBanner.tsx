interface RemainingBannerProps {
  remainingProtein: number;
  remainingCalories: number;
}

export function RemainingBanner({ remainingProtein, remainingCalories }: RemainingBannerProps) {
  const proteinHit = remainingProtein <= 0;
  const caloriesHit = remainingCalories <= 0;

  let message: string;
  if (proteinHit && caloriesHit) {
    message = "You've hit all your goals today! 🌿 Great work.";
  } else if (proteinHit) {
    message = `Protein goal hit! ✅ Focus on your ${Math.round(remainingCalories)} kcal remaining.`;
  } else if (caloriesHit) {
    message = `Calorie goal hit! Just ${Math.round(remainingProtein)}g more protein to go.`;
  } else {
    message = `You need ${Math.round(remainingProtein)}g more protein and ${Math.round(remainingCalories)} kcal today.`;
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-foreground flex items-start gap-2"
      style={{ backgroundColor: "#EAF4EE", border: "1px solid #5BB882" }}
    >
      <span className="text-base leading-none mt-0.5">🌿</span>
      <span className="flex-1">{message}</span>
    </div>
  );
}
