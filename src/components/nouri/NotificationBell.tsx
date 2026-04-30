import { useEffect, useState } from "react";
import { Bell, Sparkles, Plus, X, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  notifStore,
  ensureNotificationPermission,
  fetchSuggestions,
  type MealSuggestion,
  type SuggestionNotification,
  currentMealWindow,
  triggerStore,
} from "@/lib/nouri-suggestions";
import type { Goals, Meal, MealType } from "@/lib/nouri-storage";
import { todayISO, mealTypeEmoji } from "@/lib/nouri-storage";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NotificationBellProps {
  goals: Goals;
  meals: Meal[];
  onAddMeal: (m: Meal) => void;
  refreshKey: number;
}

export function NotificationBell({ goals, meals, onAddMeal, refreshKey }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SuggestionNotification[]>(() => notifStore.list());
  const [generatingType, setGeneratingType] = useState<MealType | null>(null);

  useEffect(() => {
    setItems(notifStore.list());
  }, [refreshKey, open]);

  // Ask for notification permission once when the bell first appears
  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  const unread = items.filter((i) => !i.read).length;

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      notifStore.markAllRead();
      setItems(notifStore.list());
    }
  };

  const handleManualSuggest = async () => {
    const mealType: MealType = currentMealWindow() ?? "Snack";
    setGeneratingType(mealType);
    try {
      const suggestions = await fetchSuggestions(goals, meals, mealType);
      const notif: SuggestionNotification = {
        id: crypto.randomUUID(),
        created_at: Date.now(),
        mealType,
        suggestions,
        read: true,
      };
      notifStore.add(notif);
      triggerStore.markFired(mealType);
      setItems(notifStore.list());
      toast(`${mealType} ideas ready`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't get suggestions");
    } finally {
      setGeneratingType(null);
    }
  };

  const handleLog = (notifId: string, s: MealSuggestion, type: MealType) => {
    onAddMeal({
      id: crypto.randomUUID(),
      meal_name: s.meal_name,
      type,
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
      date: todayISO(),
      created_at: Date.now(),
    });
    toast.success(`${s.meal_name} logged`);
  };

  const handleDismiss = (id: string) => {
    notifStore.remove(id);
    setItems(notifStore.list());
  };

  return (
    <>
      <button
        onClick={() => handleOpen(true)}
        aria-label="Meal suggestions"
        className="relative text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono-data flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-background">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
            <SheetTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Meal suggestions
            </SheetTitle>
            <SheetDescription className="text-xs">
              Tailored to your remaining macros today.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 py-4 border-b border-border">
            <button
              onClick={handleManualSuggest}
              disabled={generatingType !== null}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {generatingType ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Thinking…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Suggest meals now
                </>
              )}
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-4 max-h-[calc(100vh-180px)]">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                No suggestions yet. Nouri will nudge you around meal times.
              </p>
            )}

            {items.map((n) => (
              <div key={n.id} className="nouri-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base">{n.mealType} ideas</span>
                  </div>
                  <button
                    onClick={() => handleDismiss(n.id)}
                    aria-label="Dismiss"
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {n.suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">{s.meal_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {s.description}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLog(n.id, s, n.mealType)}
                          className="shrink-0 text-primary hover:bg-primary/10 rounded-full p-1.5"
                          aria-label="Log this meal"
                          title="Log this meal"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 font-mono-data text-[11px] text-muted-foreground">
                        <span>{s.calories} kcal</span>
                        <span>·</span>
                        <span>P {s.protein}g</span>
                        <span>·</span>
                        <span>C {s.carbs}g</span>
                        <span>·</span>
                        <span>F {s.fat}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
