export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface Meal {
  id: string;
  meal_name: string;
  type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
  created_at: number;
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_GOALS: Goals = {
  calories: 2500,
  protein: 150,
  carbs: 200,
  fat: 70,
};

const KEYS = {
  goals: "nouri:goals",
  meals: "nouri:meals",
  onboarded: "nouri:onboarded",
};

export const storage = {
  getGoals(): Goals {
    try {
      const raw = localStorage.getItem(KEYS.goals);
      if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_GOALS;
  },
  setGoals(g: Goals) {
    localStorage.setItem(KEYS.goals, JSON.stringify(g));
  },
  getMeals(): Meal[] {
    try {
      const raw = localStorage.getItem(KEYS.meals);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  },
  setMeals(meals: Meal[]) {
    localStorage.setItem(KEYS.meals, JSON.stringify(meals));
  },
  addMeal(m: Meal) {
    const all = storage.getMeals();
    all.unshift(m);
    storage.setMeals(all);
  },
  removeMeal(id: string) {
    storage.setMeals(storage.getMeals().filter((m) => m.id !== id));
  },
  isOnboarded(): boolean {
    return localStorage.getItem(KEYS.onboarded) === "true";
  },
  setOnboarded(v: boolean) {
    localStorage.setItem(KEYS.onboarded, v ? "true" : "false");
  },
  reset() {
    localStorage.removeItem(KEYS.goals);
    localStorage.removeItem(KEYS.meals);
    localStorage.removeItem(KEYS.onboarded);
  },
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const mealTypeEmoji = (t: MealType) =>
  ({ Breakfast: "", Lunch: "", Dinner: "", Snack: "" }[t]);
