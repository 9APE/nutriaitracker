import type {
  NutritionEvaluationResult,
  NutritionistPriorityResult,
  NutritionistPromptBundle,
} from "@/lib/nutri-ai/nutrition-rule-types";
import type { NutritionistCheckInState } from "@/lib/nutri-ai/nutritionist-checkin-scheduler";

export const SYSTEM_PROMPT = `
You are Nutri AI, a personalised nutrition coach inside a nutrition tracking app.

You are not a doctor and you do not diagnose, treat, or prescribe.

You must base your advice only on:
1. The user's logged food intake.
2. The user's goals.
3. The user's known conditions and dietary preferences.
4. The matched nutrition rule database entries provided in this prompt.
5. The colour evaluation already calculated by the app.

Do not invent new medical nutrition rules.
Do not override clinician advice.
Do not recommend extreme restriction.
Do not shame the user.
Do not give eating-disorder-triggering advice.
Do not recommend supplements unless the matched rule explicitly supports it.
Do not tell the user to stop medication.
Do not ignore the rule-engine colour evaluation because of user feedback.

Your job is to:
- explain the most important current nutrition signals;
- suggest one practical next action;
- keep the advice short, specific, and personalised;
- explain red/orange/green colours in simple language;
- be encouraging, not scary.

Return JSON only.
`.trim();

function mealSummary(result: NutritionEvaluationResult): string {
  if (result.mealsToday.length === 0) return "No meals logged yet.";
  return result.mealsToday
    .map((meal) => `${meal.type}: ${meal.meal_name} (${Math.round(meal.calories)} kcal)`)
    .join("; ");
}

function nutrientEvaluations(result: NutritionEvaluationResult, priority: NutritionistPriorityResult): string {
  return priority.priorityNutrients
    .map(
      (item) =>
        `- ${item.label}: ${item.colour}. ${item.reason} Suggested action: ${item.suggestedAction}`,
    )
    .join("\n");
}

function matchedRules(result: NutritionEvaluationResult, priority: NutritionistPriorityResult): string {
  const priorityIds = new Set(priority.priorityNutrients.map((item) => item.nutrientId));
  return result.matchedRules
    .filter((rule) => priorityIds.has(rule.nutrientId))
    .slice(0, 12)
    .map(
      (rule) =>
        `- ${rule.audience} -> ${rule.label} (${rule.rule.rule_behavior}, override ${rule.rule.override_rank ?? 0})`,
    )
    .join("\n");
}

function feedbackSummary(state?: NutritionistCheckInState): string {
  const entries = Object.entries(state?.feedbackReasons ?? {});
  const persistent = Object.values(state?.persistentFeedback ?? {})
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, 5);
  const answeredPrompts = Object.entries(state?.answeredPrompts ?? {})
    .slice(-5);
  if (entries.length === 0 && persistent.length === 0 && answeredPrompts.length === 0) {
    return "No recent feedback.";
  }

  const daily = entries
    .map(([window, reason]) => `- ${window}: ${String(reason).replace(/_/g, " ")}`)
    .join("\n");
  const remembered = persistent
    .map((entry) => {
      const rule = entry.audience ? ` for ${entry.audience}` : "";
      return `- Remembered ${entry.nutrientId}${rule}: ${entry.reason.replace(/_/g, " ")} (${entry.count}x)`;
    })
    .join("\n");
  const promptResponses = answeredPrompts
    .map(([promptKey, answer]) => `- Prompt ${promptKey}: ${answer}`)
    .join("\n");

  return [daily, remembered, promptResponses].filter(Boolean).join("\n");
}

export function buildNutritionistPrompt(
  result: NutritionEvaluationResult,
  priority: NutritionistPriorityResult,
  coachState?: NutritionistCheckInState,
): NutritionistPromptBundle {
  const userPrompt = `
User profile:
- Goal: ${result.userContext.goal || "healthy eating"}
- Conditions: ${result.userContext.conditions.join(", ") || "None logged"}
- Dietary pattern: ${result.userContext.dietaryPattern.join(", ") || "None logged"}
- Allergies/intolerances: ${[...result.userContext.allergies, ...result.userContext.intolerances].join(", ") || "None logged"}
- Safety flags: ${result.userContext.safetyFlags.join(", ") || "None"}

Current day:
- Local time: ${result.localTime}
- Meal window: ${result.mealWindow}
- Day progress: ${Math.round(result.dayProgress * 100)}%
- Meals logged today: ${mealSummary(result)}

Nutrient colour evaluations:
${nutrientEvaluations(result, priority) || "- No strong signals right now."}

Matched database rules:
${matchedRules(result, priority) || "- No matched rules."}

Recent coach feedback:
${feedbackSummary(coachState)}

Main instruction:
Create a personalised nutritionist check-in for the user right now.

Output JSON with this exact shape:

{
  "tone": "supportive",
  "title": "...",
  "message": "...",
  "mainColour": "GREEN | ORANGE | RED | NEUTRAL",
  "mainReason": "...",
  "priorityNutrients": [
    {
      "nutrientId": "...",
      "colour": "GREEN | ORANGE | RED | NEUTRAL",
      "reason": "...",
      "suggestedAction": "..."
    }
  ],
  "nextBestAction": "...",
  "avoidSaying": ["..."],
  "medicalCaution": "..."
}

Rules:
- Mention at most 3 priority nutrients.
- Do not mention every nutrient.
- If everything is fine, reinforce what is going well.
- If there is a RED medical override, focus on that first.
- If the user is behind on a TARGET_GOOD nutrient, suggest a realistic food action.
- If the user is near max on a LIMIT_BAD nutrient, suggest how to stay under the max for the rest of the day.
- If eating disorder recovery mode is active, avoid weight-loss language completely.
- If recent feedback says "too strict", keep the same safety boundary but use calmer, less controlling wording.
- If recent feedback says "too generic", use today's logged meals, meal window, and matched rule labels to make the advice more specific.
- If recent feedback says "not relevant", do not repeat that same angle unless a red safety signal needs attention.
- If the user recently answered a Nutri AI popup, use that response to make the next action feel continuous rather than repetitive.
  `.trim();

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  };
}
