import { useState, useCallback } from "react";
import { CalendarDays, RefreshCw, ShoppingCart, BookOpen, Loader2, ArrowLeftRight, Bookmark, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getCurrentPlan,
  savePlan,
  clearCurrentPlan,
  getCurrentWeekKey,
  getRecentMealNames,
  updateMealInPlan,
  DAYS,
  MEAL_SLOTS,
  type WeeklyPlan,
  type PlannedMeal,
  type MealSlot,
} from "@/lib/nouri-meal-plan";
import { saveRecipe, type SavedRecipe } from "@/lib/nouri-recipes";
import { getFamilyMembers, getHouseholdSize, getMergedFamilyRestrictions, isFamilyMode } from "@/lib/family-utils";
import { GroceryList } from "@/components/nouri/GroceryList";
import { RecipeLibrary } from "@/components/nouri/RecipeLibrary";
import type { Goals } from "@/lib/nouri-storage";

interface Props {
  goals: Goals;
  userProfile?: any;
}

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

export function PlanScreen({ goals, userProfile }: Props) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(() => getCurrentPlan());
  const [generating, setGenerating] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null); // "day:slot"
  const [mode, setMode] = useState<"individual" | "family">("individual");
  const [view, setView] = useState<"plan" | "grocery" | "recipes">("plan");
  const [showModeSelect, setShowModeSelect] = useState(false);

  const weekKey = getCurrentWeekKey();
  const familyMembers = getFamilyMembers();
  const hasFamilyMembers = familyMembers.length > 0;

  const generatePlan = useCallback(async (planMode: "individual" | "family") => {
    setMode(planMode);
    setShowModeSelect(false);
    setGenerating(true);

    try {
      let profile: Record<string, any> = userProfile ?? {};
      if (!Object.keys(profile).length) {
        try {
          const raw = localStorage.getItem("userProfile");
          if (raw) profile = JSON.parse(raw);
        } catch {}
      }

      const body: Record<string, any> = {
        profile,
        goals,
        recentMealNames: getRecentMealNames(),
        language: localStorage.getItem("nouri:language") || "en",
      };

      if (planMode === "family") {
        body.familyMode = true;
        body.familyRestrictions = getMergedFamilyRestrictions();
        body.householdSize = getHouseholdSize();
      }

      const { data, error } = await supabase.functions.invoke("plan-meals", { body });
      if (error) throw error;

      const newPlan: WeeklyPlan = {
        weekKey,
        plan: data.plan,
        createdAt: new Date().toISOString(),
        mode: planMode,
      };
      savePlan(newPlan);
      setPlan(newPlan);
      toast.success("Meal plan generated!");
    } catch (e: any) {
      console.error("Plan generation failed:", e);
      toast.error(e?.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }, [goals, weekKey]);

  const handleSwap = useCallback(async (day: string, slot: MealSlot) => {
    if (!plan) return;
    const key = `${day}:${slot}`;
    setSwapping(key);

    try {
      let profile: Record<string, any> = {};
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) profile = JSON.parse(raw);
      } catch {}

      const body: Record<string, any> = {
        profile,
        goals,
        recentMealNames: getRecentMealNames(),
        swapDay: day,
        swapMealType: slot,
        existingPlan: plan,
        language: localStorage.getItem("nouri:language") || "en",
      };

      if (plan.mode === "family") {
        body.familyMode = true;
        body.familyRestrictions = getMergedFamilyRestrictions();
        body.householdSize = getHouseholdSize();
      }

      const { data, error } = await supabase.functions.invoke("plan-meals", { body });
      if (error) throw error;

      if (data.swapped) {
        updateMealInPlan(day, slot, data.swapped);
        setPlan(getCurrentPlan());
        toast.success("Meal swapped!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Swap failed");
    } finally {
      setSwapping(null);
    }
  }, [plan, goals]);

  const handleSaveRecipe = (meal: PlannedMeal, slot: MealSlot) => {
    const recipe: SavedRecipe = {
      id: crypto.randomUUID(),
      meal_name: meal.meal_name,
      meal_type: (slot.charAt(0).toUpperCase() + slot.slice(1)) as any,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      prep_time: meal.prep_time,
      ingredients: meal.ingredients,
      why: meal.why,
      savedAt: new Date().toISOString(),
      source: "plan",
    };
    saveRecipe(recipe);
    toast.success(`${meal.meal_name} saved to recipes`);
  };

  const handleRegenerate = () => {
    clearCurrentPlan();
    setPlan(null);
  };

  if (view === "grocery") {
    return <GroceryList plan={plan} onBack={() => setView("plan")} />;
  }

  if (view === "recipes") {
    return <RecipeLibrary onBack={() => setView("plan")} />;
  }

  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      {/* Header actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("recipes")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
        >
          <BookOpen size={13} /> Recipes
        </button>
        {plan && (
          <button
            onClick={() => setView("grocery")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
          >
            <ShoppingCart size={13} /> Shopping List
          </button>
        )}
      </div>

      {!plan && !generating && (
        <div className="text-center py-12 space-y-4">
          <CalendarDays size={40} className="mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-lg font-serif font-medium">Weekly Meal Plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a personalized 7-day meal plan
            </p>
          </div>

          {showModeSelect ? (
            <div className="space-y-2 max-w-xs mx-auto">
              <button
                onClick={() => generatePlan("individual")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors"
              >
                <User size={18} className="text-primary" />
                <div className="text-left">
                  <div className="text-sm font-medium">Plan for myself</div>
                  <div className="text-[11px] text-muted-foreground">Based on your personal profile</div>
                </div>
              </button>
              {hasFamilyMembers && (
                <button
                  onClick={() => generatePlan("family")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors"
                >
                  <Users size={18} className="text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Plan for my family</div>
                    <div className="text-[11px] text-muted-foreground">{familyMembers.length + 1} people, merged restrictions</div>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => hasFamilyMembers ? setShowModeSelect(true) : generatePlan("individual")}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Generate my week
            </button>
          )}
        </div>
      )}

      {generating && (
        <div className="text-center py-16 space-y-3">
          <Loader2 size={28} className="mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generating your meal plan...</p>
          <p className="text-[11px] text-muted-foreground">This may take 15–30 seconds</p>
        </div>
      )}

      {plan && !generating && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Week of {weekKey}</div>
              {plan.mode === "family" && (
                <div className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
                  <Users size={10} /> Family mode
                </div>
              )}
            </div>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
            >
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>

          {DAYS.map((day) => {
            const dayPlan = plan.plan[day];
            if (!dayPlan) return null;
            return (
              <div key={day} className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground px-1">{day}</h3>
                <div className="space-y-1.5">
                  {MEAL_SLOTS.map((slot) => {
                    const meal = (dayPlan as any)[slot] as PlannedMeal | undefined;
                    if (!meal) return null;
                    const isSwapping = swapping === `${day}:${slot}`;
                    return (
                      <div
                        key={slot}
                        className="rounded-xl border border-border bg-card p-3 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">{SLOT_EMOJI[slot]}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{meal.meal_name}</div>
                              <div className="text-[10px] text-muted-foreground capitalize">{slot}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleSwap(day, slot)}
                              disabled={isSwapping}
                              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                              title="Swap meal"
                            >
                              {isSwapping ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />}
                            </button>
                            <button
                              onClick={() => handleSaveRecipe(meal, slot)}
                              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Save to recipes"
                            >
                              <Bookmark size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>{meal.calories} kcal</span>
                          <span>{meal.protein}g P</span>
                          <span>{meal.carbs}g C</span>
                          <span>{meal.fat}g F</span>
                        </div>
                        {meal.why && (
                          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{meal.why}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
