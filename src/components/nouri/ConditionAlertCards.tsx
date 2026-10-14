import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { evaluateConditionRules, type RuleStatus } from "@/lib/nutri-ai-condition-evaluator";

/** Condition -> reason sentence + credible source */
export const CONDITION_REASONS: Record<string, { reason: string; source: string; sourceUrl: string }> = {
  "Celiac Disease": {
    reason: "Celiac damages the small intestine lining and changes how the body handles key nutrients.",
    source: "ESPEN / NHS",
    sourceUrl: "https://www.nhs.uk/conditions/coeliac-disease/",
  },
  "Crohn's Disease": {
    reason: "Crohn's can reduce absorption and increase gastrointestinal nutrient losses.",
    source: "ESPEN / Crohn's & Colitis Foundation",
    sourceUrl: "https://www.crohnscolitisfoundation.org/diet-and-nutrition",
  },
  "Ulcerative Colitis": {
    reason: "IBD can shift both symptom triggers and deficiency risk across the day.",
    source: "ESPEN / Crohn's & Colitis Foundation",
    sourceUrl: "https://www.crohnscolitisfoundation.org/diet-and-nutrition",
  },
  "Type 2 Diabetes": {
    reason: "Sugar, carbs, fiber, and heart-health limits matter differently for diabetes than for general users.",
    source: "American Diabetes Association",
    sourceUrl: "https://diabetes.org/food-nutrition",
  },
  "Type 1 Diabetes": {
    reason: "Glucose management depends on more than calories alone, so sugar and carb quality need their own logic.",
    source: "American Diabetes Association",
    sourceUrl: "https://diabetes.org/food-nutrition",
  },
  Hypertension: {
    reason: "Sodium and potassium balance directly change blood-pressure risk.",
    source: "NHS / AHA",
    sourceUrl: "https://www.heart.org/en/health-topics/high-blood-pressure",
  },
  "High Cholesterol": {
    reason: "Fat quality matters more than generic calories here, especially saturated fat and fiber.",
    source: "Mayo Clinic / AHA",
    sourceUrl: "https://www.mayoclinic.org/diseases-conditions/high-blood-cholesterol/in-depth/reduce-cholesterol/art-20045935",
  },
  Endometriosis: {
    reason: "Inflammation-sensitive patterns mean some nutrients help while others can work against symptom control.",
    source: "Endometriosis Foundation",
    sourceUrl: "https://www.endometriosis.org/resources/articles/diet/",
  },
  Hypothyroidism: {
    reason: "Thyroid-supportive nutrients should not be judged the same way as general wellness metrics.",
    source: "American Thyroid Association",
    sourceUrl: "https://www.thyroid.org/",
  },
  Hyperthyroidism: {
    reason: "Bone-supporting nutrients become more important because hyperthyroidism increases metabolic stress.",
    source: "American Thyroid Association",
    sourceUrl: "https://www.thyroid.org/",
  },
  "Kidney Disease": {
    reason: "Some nutrients that are healthy for most people become riskier when kidney clearance is impaired.",
    source: "National Kidney Foundation",
    sourceUrl: "https://www.kidney.org/nutrition",
  },
  Vegetarian: {
    reason: "A vegetarian pattern can need different nutrient emphasis than an omnivorous baseline.",
    source: "NIH Office of Dietary Supplements",
    sourceUrl: "https://ods.od.nih.gov/",
  },
  Vegan: {
    reason: "A vegan pattern shifts which nutrients are protective and which need extra attention.",
    source: "NIH Office of Dietary Supplements",
    sourceUrl: "https://ods.od.nih.gov/",
  },
  Osteoporosis: {
    reason: "Bone-density support changes how calcium and vitamin D should be interpreted.",
    source: "NIH / NHS",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/",
  },
  "Heart Disease": {
    reason: "Cardiovascular safety means sodium and saturated fat should be judged more strictly.",
    source: "AHA",
    sourceUrl: "https://www.heart.org/en/healthy-living/healthy-eating",
  },
  PCOS: {
    reason: "Insulin-sensitive patterns mean sugar, carbs, and protein balance matter differently.",
    source: "NHS / PubMed",
    sourceUrl: "https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/",
  },
  Pregnancy: {
    reason: "Pregnancy changes what counts as supportive versus risky, especially for nutrient sufficiency.",
    source: "NIH / WHO",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/",
  },
  "Iron Deficiency Anaemia": {
    reason: "Iron repletion needs stronger weighting than generic wellness guidance.",
    source: "NIH",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
  },
  Obesity: {
    reason: "Weight-management support should weigh calories, satiety, protein, and sugar together.",
    source: "WHO",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
  },
  IBS: {
    reason: "IBS can turn otherwise healthy foods into symptom triggers depending on the person's pattern.",
    source: "NHS",
    sourceUrl: "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/",
  },
};

interface Props {
  conditions: string[];
  totals: Record<string, number>;
  goals: Record<string, number>;
}

function tone(status: RuleStatus) {
  switch (status) {
    case "bad":
      return {
        bg: "hsl(var(--destructive) / 0.10)",
        border: "hsl(var(--destructive) / 0.28)",
        fg: "hsl(var(--destructive))",
        dot: "hsl(var(--destructive))",
      };
    case "caution":
      return {
        bg: "hsl(var(--tone-warm-bg, 38 100% 97%))",
        border: "hsl(var(--tone-warm-border, 38 80% 75%))",
        fg: "hsl(var(--tone-warm-fg, 30 50% 35%))",
        dot: "hsl(38 90% 55%)",
      };
    case "good":
      return {
        bg: "hsl(var(--primary) / 0.08)",
        border: "hsl(var(--primary) / 0.25)",
        fg: "hsl(var(--primary))",
        dot: "hsl(142 60% 45%)",
      };
    default:
      return {
        bg: "hsl(var(--muted) / 0.45)",
        border: "hsl(var(--border))",
        fg: "hsl(var(--muted-foreground))",
        dot: "hsl(var(--muted-foreground))",
      };
    }
}

function overallStatus(statuses: RuleStatus[]): RuleStatus {
  if (statuses.includes("bad")) return "bad";
  if (statuses.includes("caution")) return "caution";
  if (statuses.includes("good")) return "good";
  return "neutral";
}

export function ConditionAlertCards({ conditions, totals, goals }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!conditions.length) return null;

  const conditionRules = evaluateConditionRules({ conditions, totals, goals });
  const matchedConditions = conditions.filter((condition) => (conditionRules[condition] ?? []).length > 0);
  if (!matchedConditions.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {matchedConditions.map((condition) => {
          const alerts = conditionRules[condition] || [];
          const status = overallStatus(alerts.map((alert) => alert.status));
          const colors = tone(status);
          const isOpen = expanded === condition;

          return (
            <button
              key={condition}
              onClick={() => setExpanded(isOpen ? null : condition)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
              style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.fg }}
              aria-expanded={isOpen}
            >
              {status !== "good" && <AlertTriangle size={11} className="shrink-0" />}
              <span>{condition}</span>
              <span className="flex gap-0.5 items-center ml-0.5">
                {alerts.slice(0, 3).map((alert) => (
                  <span
                    key={`${condition}-${alert.metric}`}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tone(alert.status).dot }}
                  />
                ))}
              </span>
              <ChevronDown
                size={11}
                className="shrink-0 transition-transform"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
          );
        })}
      </div>

      {expanded && (() => {
        const alerts = conditionRules[expanded] || [];
        const info = CONDITION_REASONS[expanded];
        const colors = tone(overallStatus(alerts.map((alert) => alert.status)));
        return (
          <div
            className="rounded-xl border p-3 space-y-3 animate-[nouri-bubble-in_0.2s_ease]"
            style={{ borderColor: colors.border, backgroundColor: colors.bg }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" style={{ color: colors.fg }} />
              <span className="text-sm font-medium" style={{ color: colors.fg }}>{expanded}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {alerts.map((alert) => {
                const chip = tone(alert.status);
                return (
                  <span
                    key={alert.metric}
                    className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]"
                    style={{ backgroundColor: chip.bg, color: chip.fg, borderColor: chip.border }}
                  >
                    {alert.label}
                  </span>
                );
              })}
            </div>

            <div className="space-y-1.5">
              {alerts.slice(0, 3).map((alert) => {
                const detailTone = tone(alert.status);
                return (
                  <div key={`${alert.metric}-detail`} className="rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-foreground">{alert.label}</div>
                      <div className="text-[11px]" style={{ color: detailTone.fg }}>
                        {Math.round(alert.pct)}%
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {alert.explanation}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {Math.round(alert.consumed * 10) / 10}{alert.unit} / {Math.round(alert.target * 10) / 10}{alert.unit}
                    </div>
                  </div>
                );
              })}
            </div>

            {info && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">{info.reason}</p>
            )}

            {info && (
              <a
                href={info.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink size={9} /> {info.source}
              </a>
            )}
          </div>
        );
      })()}

      <p className="text-[10px] text-muted-foreground px-1">
        Personalized by your active health conditions. This is supportive guidance, not medical advice.
      </p>
    </div>
  );
}

