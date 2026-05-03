import { AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CONDITION_NUTRIENT_MAP } from "@/lib/condition-alerts";

/** Condition → reason sentence + credible source */
export const CONDITION_REASONS: Record<string, { reason: string; source: string; sourceUrl: string }> = {
  "Celiac Disease": {
    reason: "Celiac damages the small intestine lining impairing absorption of these nutrients",
    source: "ESPEN / NHS",
    sourceUrl: "https://www.nhs.uk/conditions/coeliac-disease/",
  },
  "Crohn's Disease": {
    reason: "Crohn's causes malabsorption and increased gastrointestinal losses of these nutrients",
    source: "ESPEN / Crohn's & Colitis Foundation",
    sourceUrl: "https://www.crohnscolitisfoundation.org/diet-and-nutrition",
  },
  "Ulcerative Colitis": {
    reason: "IBD causes chronic inflammation and gut losses that deplete these nutrients",
    source: "ESPEN / Crohn's & Colitis Foundation",
    sourceUrl: "https://www.crohnscolitisfoundation.org/diet-and-nutrition",
  },
  "Type 2 Diabetes": {
    reason: "Diabetes and common diabetes medications increase depletion of these micronutrients",
    source: "American Diabetes Association",
    sourceUrl: "https://diabetes.org/food-nutrition",
  },
  "Type 1 Diabetes": {
    reason: "Diabetes and insulin therapy affect micronutrient metabolism",
    source: "American Diabetes Association",
    sourceUrl: "https://diabetes.org/food-nutrition",
  },
  "Hypertension": {
    reason: "These minerals directly regulate blood pressure and are commonly deficient in hypertensive patients",
    source: "NHS / AHA",
    sourceUrl: "https://www.heart.org/en/health-topics/high-blood-pressure",
  },
  "High Cholesterol": {
    reason: "These nutrients actively help reduce LDL cholesterol and are frequently under-consumed",
    source: "Mayo Clinic / AHA",
    sourceUrl: "https://www.mayoclinic.org/diseases-conditions/high-blood-cholesterol/in-depth/reduce-cholesterol/art-20045935",
  },
  "Endometriosis": {
    reason: "Endometriosis causes chronic inflammation and menstrual blood loss increasing risk of these deficiencies",
    source: "Endometriosis Foundation",
    sourceUrl: "https://www.endometriosis.org/resources/articles/diet/",
  },
  "Hypothyroidism": {
    reason: "These nutrients are essential for thyroid hormone production and conversion",
    source: "American Thyroid Association",
    sourceUrl: "https://www.thyroid.org/",
  },
  "Hyperthyroidism": {
    reason: "Hyperthyroidism accelerates bone loss and metabolic demands",
    source: "American Thyroid Association",
    sourceUrl: "https://www.thyroid.org/",
  },
  "Kidney Disease": {
    reason: "Impaired kidney function causes dangerous accumulation of these nutrients",
    source: "National Kidney Foundation",
    sourceUrl: "https://www.kidney.org/nutrition",
  },
  "Vegetarian": {
    reason: "Plant-based diets lack or poorly absorb these nutrients found primarily in animal products",
    source: "NIH Office of Dietary Supplements",
    sourceUrl: "https://ods.od.nih.gov/",
  },
  "Vegan": {
    reason: "Vegan diets eliminate all animal products which are the primary source of these nutrients",
    source: "NIH Office of Dietary Supplements",
    sourceUrl: "https://ods.od.nih.gov/",
  },
  "Osteoporosis": {
    reason: "These nutrients are essential for maintaining bone density and preventing fractures",
    source: "NIH / NHS",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/",
  },
  "Heart Disease": {
    reason: "Cardiovascular health depends on controlling these nutrients to reduce cardiac workload",
    source: "AHA",
    sourceUrl: "https://www.heart.org/en/healthy-living/healthy-eating",
  },
  "PCOS": {
    reason: "PCOS involves insulin resistance — these nutrients help manage hormonal imbalance",
    source: "NHS / PubMed",
    sourceUrl: "https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/",
  },
  "Pregnancy": {
    reason: "Pregnancy dramatically increases nutrient demands for foetal development",
    source: "NIH / WHO",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/",
  },
  "Iron Deficiency Anaemia": {
    reason: "Iron stores are critically low and need therapeutic-level replenishment",
    source: "NIH",
    sourceUrl: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
  },
  "Obesity": {
    reason: "Weight management requires high fibre, adequate protein and controlled sugar",
    source: "WHO",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
  },
  "IBS": {
    reason: "IBS requires careful fibre management to avoid triggering symptoms",
    source: "NHS",
    sourceUrl: "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/",
  },
};

interface Props {
  conditions: string[];
  totals: Record<string, number>;
  goals: Record<string, number>;
}

export function ConditionAlertCards({ conditions, totals, goals }: Props) {
  if (!conditions.length) return null;

  const matchedConditions = conditions.filter((c) => CONDITION_NUTRIENT_MAP[c]);
  if (!matchedConditions.length) return null;

  return (
    <div className="space-y-2">
      {matchedConditions.map((condition) => {
        const alerts = CONDITION_NUTRIENT_MAP[condition] || [];
        const info = CONDITION_REASONS[condition];
        if (!alerts.length) return null;

        return (
          <div
            key={condition}
            className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{condition}</span>
            </div>

            {/* At-risk nutrients as pill badges */}
            <div className="flex flex-wrap gap-1.5">
              {alerts.map((alert) => {
                const consumed = totals[alert.nutrient] ?? 0;
                const target = goals[alert.nutrient] ?? alert.dailyTargetMg;
                const pct = target > 0 ? (consumed / target) * 100 : 0;
                const isGreen =
                  (alert.direction === "min" && pct >= 100) ||
                  (alert.direction === "max" && pct <= 100);

                return (
                  <Badge
                    key={alert.nutrient}
                    variant="outline"
                    className={
                      isGreen
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]"
                    }
                  >
                    {isGreen && "✓ "}{alert.label}
                    {alert.direction === "max" && " ⬇"}
                  </Badge>
                );
              })}
            </div>

            {/* Reason */}
            {info && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {info.reason}
              </p>
            )}

            {/* Source link */}
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
      })}
      <p className="text-[10px] text-muted-foreground px-1">
        Not medical advice — consult your doctor or dietitian.
      </p>
    </div>
  );
}
