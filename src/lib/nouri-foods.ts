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

// ────────────────────────────────────────────────────────────────────────────
// Nutrition-label OCR parsing
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedLabel {
  name?: string;
  brand?: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
}

/** Parse a number from a string like "12,3 g", "12.3g", "234 kcal". */
function pickNumber(s: string): number | undefined {
  // tolerate comma decimals + odd unicode whitespace
  const cleaned = s.replace(/\u00a0/g, " ").replace(/(\d),(\d)/g, "$1.$2");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse the raw OCR'd text of a Nutrition Facts / "valeurs nutritionnelles"
 * panel. Best-effort, multilingual-friendly heuristics.
 *
 * Always normalises to per-100g values when possible. If the label appears
 * to be per-serving only, the values are returned as-is and the user can
 * correct them in the form.
 */
export function parseNutritionLabel(rawText: string): ParsedLabel {
  const text = rawText.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedLabel = {};

  // Brand / product name = first 1-2 short ALL-CAPS-ish lines without numbers
  const candidateNameLines = lines
    .filter(
      (l) =>
        l.length >= 3 &&
        l.length <= 40 &&
        !/\d/.test(l) &&
        !/(nutrition|valeurs|per\s*100|pour\s*100|facts|información)/i.test(l),
    )
    .slice(0, 2);
  if (candidateNameLines.length >= 1) out.name = candidateNameLines[0];
  if (candidateNameLines.length >= 2) out.brand = candidateNameLines[1];

  // Try to figure out if values are per 100g or per serving.
  // We default to "per 100g" — the most common format in EU/UK labels.
  // Then we extract the first matching number per nutrient.
  const findValue = (patterns: RegExp[]): number | undefined => {
    for (const re of patterns) {
      for (const line of lines) {
        if (re.test(line)) {
          const n = pickNumber(line);
          if (n !== undefined) return n;
        }
      }
    }
    return undefined;
  };

  // Calories — prefer kcal lines; fall back to kJ → kcal conversion (÷ 4.184)
  let kcal = findValue([
    /\bkcal\b/i,
    /\bcalories?\b/i,
    /\b(?:énergie|energie|energy)\b.*kcal/i,
    /^\s*énergie\b/i,
  ]);
  if (kcal === undefined) {
    const kj = findValue([/\bkj\b/i, /\b(?:énergie|energie|energy)\b.*kj/i]);
    if (kj !== undefined) kcal = Math.round(kj / 4.184);
  }
  if (kcal !== undefined) out.caloriesPer100g = Math.round(kcal);

  const protein = findValue([/\b(prot[eé]ines?|protein)\b/i]);
  if (protein !== undefined) out.proteinPer100g = Math.round(protein * 10) / 10;

  // "Glucides" (FR) / "Carbohydrates" (EN) — but NOT "of which sugars"
  const carbs = findValue([
    /^(?!.*(of which|dont)).*\b(glucides|carbohydrates?|carbs)\b/i,
    /\b(glucides|carbohydrates?|carbs)\b/i, // fallback if first regex too strict
  ]);
  if (carbs !== undefined) out.carbsPer100g = Math.round(carbs * 10) / 10;

  // Total fat — but NOT "saturated" / "saturés"
  const fat = findValue([
    /^(?!.*(satur|of which)).*\b(fat|lipides|mati[eè]res grasses|grasas)\b/i,
    /\b(fat|lipides)\b/i,
  ]);
  if (fat !== undefined) out.fatPer100g = Math.round(fat * 10) / 10;

  return out;
}

