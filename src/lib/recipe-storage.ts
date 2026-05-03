export interface RecipeEntry {
  id: string;
  meal_name: string;
  source: "recommended" | "planned" | "logged";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  prepMinutes: number | null;
  tags: string[];
  savedAt: string;
  restriction_badges: string[];
}

const RECIPES_KEY = "nutriai:recipes";
const MAX_RECIPES = 200;
const WARN_AT = 180;

export function getRecipes(): RecipeEntry[] {
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    return raw ? (JSON.parse(raw) as RecipeEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRecipes(recipes: RecipeEntry[]) {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function saveRecipe(entry: Omit<RecipeEntry, "id" | "savedAt">): RecipeEntry {
  const recipes = getRecipes();
  const existing = recipes.findIndex((r) => r.meal_name.toLowerCase() === entry.meal_name.toLowerCase());
  if (existing !== -1) {
    // Update existing
    recipes[existing] = { ...recipes[existing], ...entry };
    saveRecipes(recipes);
    return recipes[existing];
  }
  // Evict unrated recipes when at cap
  let trimmed = recipes;
  if (trimmed.length >= MAX_RECIPES) {
    const unrated = trimmed.findIndex((r) => r.rating === 0);
    if (unrated !== -1) trimmed = trimmed.filter((_, i) => i !== unrated);
    else trimmed = trimmed.slice(1); // FIFO
  }
  const newEntry: RecipeEntry = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString().slice(0, 10),
  };
  trimmed.push(newEntry);
  saveRecipes(trimmed);
  return newEntry;
}

export function deleteRecipe(id: string) {
  saveRecipes(getRecipes().filter((r) => r.id !== id));
}

export function updateRecipeRating(id: string, rating: RecipeEntry["rating"]) {
  const recipes = getRecipes();
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx !== -1) {
    recipes[idx].rating = rating;
    saveRecipes(recipes);
  }
}

export function isRecipeSaved(mealName: string): boolean {
  return getRecipes().some((r) => r.meal_name.toLowerCase() === mealName.toLowerCase());
}

export function getRecipeCount(): number {
  return getRecipes().length;
}

export function isNearRecipeCap(): boolean {
  return getRecipeCount() >= WARN_AT;
}

/** Returns the top-rated recipe names for injection into AI prompts */
export function getTopRatedRecipeNames(limit = 10): string[] {
  return getRecipes()
    .filter((r) => r.rating >= 4)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((r) => r.meal_name);
}
