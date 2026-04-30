// Open Food Facts integration + local custom-foods cache for barcode scanning.
import type { MealType, MealMicros } from "@/lib/nouri-storage";

export interface FoodProduct {
  barcode: string;
  name: string;
  brand?: string;
  /** Per 100g */
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  /** Optional micronutrients per 100g (units match MealMicros). */
  microsPer100g?: MealMicros;
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
  const num = (v: any) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  const kcal = Number(
    n["energy-kcal_100g"] ?? n["energy-kcal"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0),
  );
  const protein = Number(n["proteins_100g"] ?? n["proteins"] ?? 0);
  const carbs = Number(n["carbohydrates_100g"] ?? n["carbohydrates"] ?? 0);
  const fat = Number(n["fat_100g"] ?? n["fat"] ?? 0);

  const micros: MealMicros = {};
  const fiber = num(n["fiber_100g"] ?? n["fiber"]);
  const sugar = num(n["sugars_100g"] ?? n["sugars"]);
  const satFat = num(n["saturated-fat_100g"] ?? n["saturated-fat"]);
  // OFF gives sodium in grams when present; salt is "salt_100g" (g). Convert to mg.
  const sodiumG = num(n["sodium_100g"] ?? n["sodium"]);
  const saltG = num(n["salt_100g"] ?? n["salt"]);
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : saltG != null ? saltG * 400 : undefined;
  const cholesterolG = num(n["cholesterol_100g"] ?? n["cholesterol"]);
  const potassiumG = num(n["potassium_100g"] ?? n["potassium"]);
  const ironG = num(n["iron_100g"] ?? n["iron"]);
  const calciumG = num(n["calcium_100g"] ?? n["calcium"]);
  const vitC = num(n["vitamin-c_100g"] ?? n["vitamin-c"]);
  const vitD = num(n["vitamin-d_100g"] ?? n["vitamin-d"]);

  if (fiber != null) micros.fiber = Math.round(fiber * 10) / 10;
  if (sugar != null) micros.sugar = Math.round(sugar * 10) / 10;
  if (satFat != null) micros.saturated_fat = Math.round(satFat * 10) / 10;
  if (sodiumMg != null) micros.sodium = Math.round(sodiumMg);
  if (cholesterolG != null) micros.cholesterol = Math.round(cholesterolG * 1000);
  if (potassiumG != null) micros.potassium = Math.round(potassiumG * 1000);
  if (ironG != null) micros.iron = Math.round(ironG * 1000 * 10) / 10;
  if (calciumG != null) micros.calcium = Math.round(calciumG * 1000);
  if (vitC != null) micros.vitamin_c = Math.round(vitC * 1000 * 10) / 10;
  // OFF reports vitamin D in grams → µg = g * 1_000_000
  if (vitD != null) micros.vitamin_d = Math.round(vitD * 1_000_000 * 10) / 10;

  return {
    barcode,
    name: p.product_name || p.generic_name || "Unnamed product",
    brand: p.brands || undefined,
    caloriesPer100g: Math.round(kcal),
    proteinPer100g: Math.round(protein * 10) / 10,
    carbsPer100g: Math.round(carbs * 10) / 10,
    fatPer100g: Math.round(fat * 10) / 10,
    microsPer100g: Object.keys(micros).length > 0 ? micros : undefined,
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
  let micros: MealMicros | undefined;
  if (product.microsPer100g) {
    micros = {};
    for (const [k, v] of Object.entries(product.microsPer100g)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        (micros as any)[k] = Math.round(v * f * 10) / 10;
      }
    }
  }
  return {
    meal_name: product.brand ? `${product.name} (${product.brand})` : product.name,
    type,
    calories: Math.round(product.caloriesPer100g * f),
    protein: Math.round(product.proteinPer100g * f),
    carbs: Math.round(product.carbsPer100g * f),
    fat: Math.round(product.fatPer100g * f),
    date,
    micros,
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
  fiberPer100g?: number;
  sugarPer100g?: number;
  saturatedFatPer100g?: number;
  /** mg per 100g */
  sodiumPer100g?: number;
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

  const fiber = findValue([/\b(fib(?:re|er)s?|fibres?)\b/i]);
  if (fiber !== undefined) out.fiberPer100g = Math.round(fiber * 10) / 10;

  const sugar = findValue([/\b(sugars?|sucres?|az[uú]cares?)\b/i]);
  if (sugar !== undefined) out.sugarPer100g = Math.round(sugar * 10) / 10;

  const satFat = findValue([/\b(satur(?:ated|és?|es)|of which satur)\b/i]);
  if (satFat !== undefined) out.saturatedFatPer100g = Math.round(satFat * 10) / 10;

  // Sodium / salt → normalize to mg per 100g (salt → sodium ≈ ÷ 2.5 → ×1000)
  const sodium = findValue([/\bsodium\b/i]);
  if (sodium !== undefined) {
    // OFF-style labels often print "0.5 g" sodium; treat <50 as grams
    out.sodiumPer100g = sodium < 50 ? Math.round(sodium * 1000) : Math.round(sodium);
  } else {
    const salt = findValue([/\b(salt|sel|sal)\b/i]);
    if (salt !== undefined) out.sodiumPer100g = Math.round(salt * 400);
  }

  return out;
}

