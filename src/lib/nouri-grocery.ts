/** Grocery list helpers */
import { userScopedKey } from "@/lib/user-scoped-storage";

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
  memberNote?: string; // e.g. "Lina (vegan)"
}

const GROCERY_KEY = "Nutri AI:groceryList";
const GROCERY_WEEK_KEY = "Nutri AI:groceryWeek";
const GROCERY_BY_WEEK_KEY = "Nutri AI:groceryListsByWeek";

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

function getGroceryListsByWeek(): Record<string, GroceryItem[]> {
  try {
    const raw = localStorage.getItem(userScopedKey(GROCERY_BY_WEEK_KEY)) ?? localStorage.getItem(GROCERY_BY_WEEK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroceryListsByWeek(lists: Record<string, GroceryItem[]>) {
  localStorage.setItem(userScopedKey(GROCERY_BY_WEEK_KEY), JSON.stringify(lists));
}

export function getGroceryList(week?: string): GroceryItem[] {
  try {
    if (week) {
      const lists = getGroceryListsByWeek();
      if (lists[week]) return lists[week];
      const legacyWeek = localStorage.getItem(userScopedKey(GROCERY_WEEK_KEY)) ?? localStorage.getItem(GROCERY_WEEK_KEY);
      if (legacyWeek !== week) return [];
    }
    const raw = localStorage.getItem(userScopedKey(GROCERY_KEY)) ?? localStorage.getItem(GROCERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGroceryList(items: GroceryItem[], week?: string) {
  if (week) {
    const lists = getGroceryListsByWeek();
    lists[week] = items;
    saveGroceryListsByWeek(lists);
  }
  localStorage.setItem(userScopedKey(GROCERY_KEY), JSON.stringify(items));
}

export function getGroceryWeek(): string | null {
  return localStorage.getItem(userScopedKey(GROCERY_WEEK_KEY)) ?? localStorage.getItem(GROCERY_WEEK_KEY);
}

export function setGroceryWeek(week: string) {
  localStorage.setItem(userScopedKey(GROCERY_WEEK_KEY), week);
}

export function toggleGroceryItem(id: string, week?: string) {
  const items = getGroceryList(week);
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx].checked = !items[idx].checked;
    saveGroceryList(items, week);
  }
  return items;
}

export function addGroceryItem(item: Omit<GroceryItem, "id" | "checked">, week?: string) {
  const items = getGroceryList(week);
  items.push({ ...item, id: crypto.randomUUID(), checked: false });
  saveGroceryList(items, week);
  return items;
}

export function removeGroceryItem(id: string, week?: string) {
  const items = getGroceryList(week).filter((i) => i.id !== id);
  saveGroceryList(items, week);
  return items;
}

export function clearGroceryList(week?: string) {
  if (week) {
    const lists = getGroceryListsByWeek();
    delete lists[week];
    saveGroceryListsByWeek(lists);
  }
  localStorage.removeItem(userScopedKey(GROCERY_KEY));
  localStorage.removeItem(userScopedKey(GROCERY_WEEK_KEY));
}

export function formatGroceryListForShare(items: GroceryItem[], weekKey: string): string {
  const lines: string[] = [`Nutri AI Shopping List - Week of ${weekKey}`, ""];
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
      const note = item.memberNote ? ` - ${item.memberNote}` : "";
      lines.push(`  ${check} ${item.name} ${item.quantity}${note}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// TODO(family-sync): Migrate grocery list to Supabase with real-time sync when Phase 4 is implemented.
