import { useState, useCallback } from "react";
import { ArrowLeft, ShoppingCart, Share2, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getGroceryList,
  saveGroceryList,
  toggleGroceryItem,
  addGroceryItem,
  removeGroceryItem,
  clearGroceryList,
  formatGroceryListForShare,
  setGroceryWeek,
  getGroceryWeek,
  GROCERY_CATEGORIES,
  type GroceryItem,
} from "@/lib/nouri-grocery";
import type { WeeklyPlan } from "@/lib/nouri-meal-plan";

interface Props {
  plan: WeeklyPlan | null;
  onBack: () => void;
}

export function GroceryList({ plan, onBack }: Props) {
  const [items, setItems] = useState<GroceryItem[]>(() => getGroceryList());
  const [generating, setGenerating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const weekKey = plan?.weekKey || "";
  const existingWeek = getGroceryWeek();
  const hasListForWeek = items.length > 0 && existingWeek === weekKey;

  const generateList = useCallback(async () => {
    if (!plan) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-grocery-list", {
        body: {
          plan: plan.plan,
          householdSize: plan.mode === "family"
            ? parseInt(localStorage.getItem("nutriai:householdSize") || "1")
            : 1,
          familyMode: plan.mode === "family",
        },
      });
      if (error) throw error;

      const groceryItems: GroceryItem[] = (data.items || []).map((item: any) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity || "",
        category: item.category || "Other",
        checked: false,
        memberNote: item.memberNote,
      }));

      saveGroceryList(groceryItems);
      setGroceryWeek(weekKey);
      setItems(groceryItems);
      toast.success("Shopping list generated!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate list");
    } finally {
      setGenerating(false);
    }
  }, [plan, weekKey]);

  const handleToggle = (id: string) => {
    const updated = toggleGroceryItem(id);
    setItems([...updated]);
  };

  const handleAdd = (category: string) => {
    if (!newItemName.trim()) return;
    const updated = addGroceryItem({ name: newItemName.trim(), quantity: "", category });
    setItems([...updated]);
    setNewItemName("");
    setAddingTo(null);
  };

  const handleRemove = (id: string) => {
    const updated = removeGroceryItem(id);
    setItems([...updated]);
  };

  const handleShare = async () => {
    const text = formatGroceryListForShare(items, weekKey);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Shopping list copied to clipboard!");
    } catch {
      toast.error("Couldn't copy — try selecting the text manually");
    }
  };

  // Group items by category
  const byCategory = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back to Plan
        </button>
        {items.length > 0 && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40"
          >
            <Share2 size={12} /> Share
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ShoppingCart size={18} className="text-primary" />
        <h2 className="text-lg font-serif font-medium">Shopping List</h2>
      </div>

      {items.length === 0 && !generating && (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">No shopping list yet</p>
          {plan && (
            <button
              onClick={generateList}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
            >
              Generate from meal plan
            </button>
          )}
        </div>
      )}

      {generating && (
        <div className="text-center py-8">
          <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Building your shopping list...</p>
        </div>
      )}

      {items.length > 0 && !hasListForWeek && plan && (
        <button
          onClick={generateList}
          className="w-full py-2 text-xs text-primary border border-primary/20 rounded-lg hover:bg-primary/5"
        >
          Regenerate for current week
        </button>
      )}

      {/* Categories */}
      {Array.from(byCategory.entries()).map(([category, catItems]) => (
        <div key={category} className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{category}</h3>
            <button
              onClick={() => setAddingTo(addingTo === category ? null : category)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} />
            </button>
          </div>

          {addingTo === category && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAdd(category); }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add item..."
                className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary/50"
              />
              <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs">Add</button>
            </form>
          )}

          {catItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 group"
            >
              <button
                onClick={() => handleToggle(item.id)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  item.checked
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {item.checked && <Check size={12} />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="text-xs text-muted-foreground ml-1.5">{item.quantity}</span>
                )}
                {item.memberNote && (
                  <span className="text-[10px] text-primary/60 ml-1.5">— {item.memberNote}</span>
                )}
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ))}

      {items.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{items.filter((i) => i.checked).length}/{items.length} items checked</span>
            <button
              onClick={() => { clearGroceryList(); setItems([]); }}
              className="text-destructive/70 hover:text-destructive"
            >
              Clear list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
