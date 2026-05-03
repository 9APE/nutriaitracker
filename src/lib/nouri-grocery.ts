/** Grocery list helpers */

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
  memberNote?: string; // e.g. "Lina (vegan)"
}

const GROCERY_KEY = "nouri:groceryList";
const GROCERY_WEEK_KEY = "nouri:groceryWeek";

export const GROCERY_CATEGORIES = [
  "Fresh Produce",
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy & Eggs",
  "Grains & Bread",
  "Canned & Dry Goods",
  "Condiments & Sauces",
  "Snacks",
  "Frozen Foods",
  "Special Items",
  "Other",
] as const;

export function getGroceryList(): GroceryItem[] {
  try {
    const raw = localStorage.getItem(GROCERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGroceryList(items: GroceryItem[]) {
  localStorage.setItem(GROCERY_KEY, JSON.stringify(items));
}

export function getGroceryWeek(): string | null {
  return localStorage.getItem(GROCERY_WEEK_KEY);
}

export function setGroceryWeek(week: string) {
  localStorage.setItem(GROCERY_WEEK_KEY, week);
}

export function toggleGroceryItem(id: string) {
  const items = getGroceryList();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx].checked = !items[idx].checked;
    saveGroceryList(items);
  }
  return items;
}

export function addGroceryItem(item: Omit<GroceryItem, "id" | "checked">) {
  const items = getGroceryList();
  items.push({ ...item, id: crypto.randomUUID(), checked: false });
  saveGroceryList(items);
  return items;
}

export function removeGroceryItem(id: string) {
  const items = getGroceryList().filter((i) => i.id !== id);
  saveGroceryList(items);
  return items;
}

export function clearGroceryList() {
  localStorage.removeItem(GROCERY_KEY);
  localStorage.removeItem(GROCERY_WEEK_KEY);
}

export function formatGroceryListForShare(items: GroceryItem[], weekKey: string): string {
  const lines: string[] = [`NutriAI Shopping List — Week of ${weekKey}`, ""];
  const byCategory = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  for (const [cat, catItems] of byCategory) {
    lines.push(`${cat}:`);
    for (const item of catItems) {
      const check = item.checked ? "✓" : "☐";
      const note = item.memberNote ? ` — ${item.memberNote}` : "";
      lines.push(`  ${check} ${item.name} ${item.quantity}${note}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// TODO(family-sync): Migrate grocery list to Supabase with real-time sync when Phase 4 is implemented.
