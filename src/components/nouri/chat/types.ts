/** Shared types used by the Nouri chat surface (logic + UI pieces). */
import type { AnalyzedMeal } from "@/lib/nouri-api";

export interface Citation {
  title: string;
  url: string;
}

export interface ChatRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  meal_id?: string | null;
  active_job_id?: string | null;
  kind?: string | null;
  created_at: string;
}

export interface MealSuggestion {
  meal_name: string;
  meal_type: string;
  why: string;
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
}

/**
 * Single source of truth for the meal-preview sheet. The sheet opens INSTANTLY
 * when the user sends a meal log (`loading=true`, `meal=null`) and fills in as
 * the AI job resolves via realtime  no intermediate bubble, no flicker.
 */
export interface PendingPreview {
  jobId: string | null;       // null = locally-known meal already populated (e.g. retry path)
  meal: AnalyzedMeal | null;  // null while loading
  error: string | null;
}

export interface PendingClarification {
  question: string;
  options: string[];
  originalText: string;
  source: "voice" | "text";
  askedAt: number;
}
