export type MessageIntent = "meal" | "question" | "mixed";

export interface MessageIntentResult {
  intent: MessageIntent;
  mealText?: string;
  questionText?: string;
}

const QUESTION_START_RE =
  /^(how|what|why|when|where|who|should|can|could|would|will|is|are|do|does|did|tell me|explain|recommend|suggest)\b/i;
const QUESTION_CUE_RE =
  /\b(how|what|why|when|where|who|should i|can i|could i|would this|is this|is that|is it|does this|does that|what about|how much|can you|should we|tell me|explain|recommend|suggest)\b/i;
const MEAL_ACTION_RE =
  /\b(log it|add it|log this|add this|track it|track this|save it|save this|add to (my )?log|log (it|this|that))\b/i;
const MEAL_DETAIL_RE =
  /\b(grams?|g of|cup|cups|tbsp|tsp|slice|slices|piece|pieces|portion|serving|ml|oz|kcal)\b/i;
const MEAL_CUE_RE =
  /\b(ate|had|eating|breakfast|lunch|dinner|snack|dessert|for breakfast|for lunch|for dinner|as a snack|today i ate|i ate|i had|i'm having|im having|having)\b/i;
const QUESTION_SPLIT_RE =
  /(?:^|[\s,.;-]+)(how|what|why|when|where|who|should i|can i|could i|would this|is this|is that|is it|does this|does that|what about|how much|can you|tell me|explain|recommend|suggest)\b/i;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeQuestion(text: string) {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (normalized.endsWith("?")) return true;
  if (QUESTION_START_RE.test(normalized)) return true;
  return QUESTION_CUE_RE.test(normalized);
}

function looksLikeMeal(text: string) {
  const normalized = normalize(text.toLowerCase());
  if (!normalized) return false;
  if (MEAL_ACTION_RE.test(normalized)) return true;
  if (MEAL_DETAIL_RE.test(normalized)) return true;
  if (MEAL_CUE_RE.test(normalized)) return true;
  return false;
}

function cleanQuestion(text: string) {
  const normalized = normalize(text).replace(/^[,.;:\s-]+/, "");
  if (!normalized) return normalized;
  return /[?]$/.test(normalized) ? normalized : `${normalized}?`;
}

function tryMixedSplit(text: string): MessageIntentResult | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const sentenceParts = normalized.split(/(?<=[?.!])\s+/).map((part) => normalize(part)).filter(Boolean);
  if (sentenceParts.length > 1) {
    const mealParts = sentenceParts.filter((part) => looksLikeMeal(part) && !looksLikeQuestion(part));
    const questionParts = sentenceParts.filter((part) => looksLikeQuestion(part));
    if (mealParts.length && questionParts.length) {
      return {
        intent: "mixed",
        mealText: normalize(mealParts.join(" ")),
        questionText: cleanQuestion(questionParts.join(" ")),
      };
    }
  }

  const match = QUESTION_SPLIT_RE.exec(normalized);
  if (match && match.index > 0) {
    const mealCandidate = normalize(normalized.slice(0, match.index).replace(/[,:;\s]+$/, ""));
    const questionCandidate = normalize(normalized.slice(match.index));
    if (mealCandidate && questionCandidate && looksLikeMeal(mealCandidate) && looksLikeQuestion(questionCandidate)) {
      return {
        intent: "mixed",
        mealText: mealCandidate,
        questionText: cleanQuestion(questionCandidate),
      };
    }
  }

  return null;
}

export function detectMessageIntent(text: string): MessageIntentResult {
  const normalized = normalize(text);
  if (!normalized) return { intent: "question", questionText: "" };

  const mixed = tryMixedSplit(normalized);
  if (mixed) return mixed;

  if (normalized.endsWith("?") || QUESTION_START_RE.test(normalized)) {
    return { intent: "question", questionText: cleanQuestion(normalized) };
  }

  if (looksLikeQuestion(normalized) && !looksLikeMeal(normalized)) {
    return { intent: "question", questionText: cleanQuestion(normalized) };
  }

  if (looksLikeMeal(normalized)) {
    return { intent: "meal", mealText: normalized };
  }

  if (normalized.split(/\s+/).length < 4) {
    return { intent: "question", questionText: cleanQuestion(normalized) };
  }

  return { intent: "meal", mealText: normalized };
}
