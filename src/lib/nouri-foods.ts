// Open Food Facts integration + local custom-foods cache for barcode scanning.
import type { MealType } from "@/lib/nouri-storage";

export interface FoodProduct {
  barcode: string;
  name: string;
  brand?: string;
  /** Per 100g */
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: "openfoodfacts" | "custom";
}

const CUSTOM_KEY = "customFoods";

export function loadCustomFoods(): FoodProduct[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FoodProduct[]) : [];
  } catch {
    return [];
  }
}

export function findCustomFood(barcode: string): FoodProduct | null {
  return loadCustomFoods().find((f) => f.barcode === barcode) ?? null;
}

export function saveCustomFood(p: FoodProduct) {
  const all = loadCustomFoods().filter((f) => f.barcode !== p.barcode);
  all.push(p);
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
  } catch {
    // storage full / disabled — silently ignore
  }
}

/** Fetch from Open Food Facts. Returns null if not found. */
export async function fetchOpenFoodFacts(barcode: string): Promise<FoodProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const data = await res.json();
  if (data?.status !== 1 || !data?.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};
  const kcal = Number(
    n["energy-kcal_100g"] ?? n["energy-kcal"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0),
  );
  const protein = Number(n["proteins_100g"] ?? n["proteins"] ?? 0);
  const carbs = Number(n["carbohydrates_100g"] ?? n["carbohydrates"] ?? 0);
  const fat = Number(n["fat_100g"] ?? n["fat"] ?? 0);

  return {
    barcode,
    name: p.product_name || p.generic_name || "Unnamed product",
    brand: p.brands || undefined,
    caloriesPer100g: Math.round(kcal),
    proteinPer100g: Math.round(protein * 10) / 10,
    carbsPer100g: Math.round(carbs * 10) / 10,
    fatPer100g: Math.round(fat * 10) / 10,
    source: "openfoodfacts",
  };
}

/** Resolve a barcode: cache → API. Throws on network errors. */
export async function resolveBarcode(barcode: string): Promise<FoodProduct | null> {
  const cached = findCustomFood(barcode);
  if (cached) return cached;
  return await fetchOpenFoodFacts(barcode);
}

/** Build a meal draft from a product + portion (grams). */
export function buildMealFromProduct(
  product: FoodProduct,
  grams: number,
  date: string,
  type: MealType = "Snack",
) {
  const f = grams / 100;
  return {
    meal_name: product.brand ? `${product.name} (${product.brand})` : product.name,
    type,
    calories: Math.round(product.caloriesPer100g * f),
    protein: Math.round(product.proteinPer100g * f),
    carbs: Math.round(product.carbsPer100g * f),
    fat: Math.round(product.fatPer100g * f),
    date,
  };
}
