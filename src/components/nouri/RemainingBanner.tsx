import { useLanguage, t } from "@/lib/nouri-i18n";

interface RemainingBannerProps {
  remainingProtein: number;
  remainingCalories: number;
}

export function RemainingBanner({ remainingProtein, remainingCalories }: RemainingBannerProps) {
  const lang = useLanguage();
  const proteinHit = remainingProtein <= 0;
  const caloriesHit = remainingCalories <= 0;

  let message: string;
  if (proteinHit && caloriesHit) {
    message = t("allGoalsHit", lang);
  } else if (proteinHit) {
    message = t("proteinGoalHit", lang, { kcal: Math.round(remainingCalories) });
  } else if (caloriesHit) {
    message = t("calorieGoalHit", lang, { g: Math.round(remainingProtein) });
  } else {
    message = t("needMore", lang, {
      g: Math.round(remainingProtein),
      kcal: Math.round(remainingCalories),
    });
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 text-sm leading-relaxed flex items-start gap-2"
      style={{
        backgroundColor: "hsl(var(--tone-success-bg))",
        border: "1px solid hsl(var(--tone-success-border))",
        color: "hsl(var(--tone-success-fg))",
      }}
    >
      <span className="flex-1">{message}</span>
    </div>
  );
}
