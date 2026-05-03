/** Recipe library localStorage helpers */

export interface SavedRecipe {
  id: string;
  meal_name: string;
  meal_type: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prep_time?: string;
  ingredients?: string[];
  why?: string;
  badges?: string[];
  rating?: number; // 1-5
  savedAt: string;
  source: "recommend" | "plan" | "logged";
}

const RECIPES_KEY = "nouri:recipes";

export function getSavedRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecipe(recipe: SavedRecipe) {
  const all = getSavedRecipes();
  // Prevent duplicates by name
  if (all.some((r) => r.meal_name.toLowerCase() === recipe.meal_name.toLowerCase())) return;
  all.unshift(recipe);
  localStorage.setItem(RECIPES_KEY, JSON.stringify(all.slice(0, 200)));
}

export function removeRecipe(id: string) {
  const all = getSavedRecipes().filter((r) => r.id !== id);
  localStorage.setItem(RECIPES_KEY, JSON.stringify(all));
}

export function updateRecipeRating(id: string, rating: number) {
  const all = getSavedRecipes();
  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) {
    all[idx].rating = rating;
    localStorage.setItem(RECIPES_KEY, JSON.stringify(all));
  }
}

// TODO(family-sync): Migrate recipes to Supabase with real-time sync when Phase 4 is implemented.
