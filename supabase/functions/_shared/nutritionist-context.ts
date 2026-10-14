export function formatNutritionistContext(context: any): string {
  if (!context || typeof context !== "object") return "";

  const evaluations = Array.isArray(context.nutrientEvaluations)
    ? context.nutrientEvaluations
        .slice(0, 3)
        .map((item: any) =>
          `- ${item.label || item.nutrientId}: ${item.colour}. ${item.reason} Action: ${item.suggestedAction}`,
        )
        .join("\n")
    : "";

  const rules = Array.isArray(context.matchedRules)
    ? context.matchedRules
        .slice(0, 8)
        .map((rule: any) =>
          `- ${rule.audience} -> ${rule.label || rule.nutrientId} (${rule.behavior}, override ${rule.overrideRank ?? 0})`,
        )
        .join("\n")
    : "";

  const risks = Array.isArray(context.topRisks)
    ? context.topRisks
        .slice(0, 3)
        .map((item: any) => `${item.label || item.nutrientId}: ${item.colour}`)
        .join(", ")
    : "";

  const familyMembers = Array.isArray(context.familyMembers)
    ? context.familyMembers
        .slice(0, 6)
        .map((member: any) => {
          const parts = [
            Array.isArray(member.conditions) && member.conditions.length ? `conditions: ${member.conditions.join(", ")}` : "",
            Array.isArray(member.allergies) && member.allergies.length ? `allergies: ${member.allergies.join(", ")}` : "",
            Array.isArray(member.restrictions) && member.restrictions.length ? `restrictions: ${member.restrictions.join(", ")}` : "",
            Array.isArray(member.goals) && member.goals.length ? `goals: ${member.goals.join(", ")}` : "",
            Array.isArray(member.dislikes) && member.dislikes.length ? `dislikes: ${member.dislikes.join(", ")}` : "",
          ].filter(Boolean).join("; ");
          return `- ${member.name || "Family member"}${member.age ? `, age ${member.age}` : ""}${parts ? ` (${parts})` : ""}`;
        })
        .join("\n")
    : "";

  return `
NUTRI AI PERSONALISED COLOUR CONTEXT
Use these app-calculated colour evaluations as the source of truth. Do not invent new medical colour logic.
Goal: ${context.goal || "not set"}
Conditions: ${Array.isArray(context.conditions) && context.conditions.length ? context.conditions.join(", ") : "None logged"}
Dietary pattern: ${Array.isArray(context.dietaryPattern) && context.dietaryPattern.length ? context.dietaryPattern.join(", ") : "None logged"}
Allergies/intolerances: ${Array.isArray(context.allergies) && context.allergies.length ? context.allergies.join(", ") : "None logged"}
Family members:
${familyMembers || "- No family members in this context."}
Meal window: ${context.mealWindow || "Unknown"} | Day progress: ${context.dayProgressPercent ?? "?"}%
Top risks: ${risks || "None"}

Nutrient evaluations:
${evaluations || "- No strong colour signals."}

Matched rules:
${rules || "- No matched rules."}

Safety instructions:
${Array.isArray(context.safetyInstructions) && context.safetyInstructions.length ? context.safetyInstructions.join("\n") : "Clinician guidance overrides app coaching."}
`.trim();
}
