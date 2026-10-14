import { useState, useCallback, useMemo } from "react";
import { CalendarDays, RefreshCw, ShoppingCart, BookOpen, Loader2, ArrowLeftRight, Bookmark, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFunctionErrorMessage } from "@/lib/function-error";
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
import { getFamilyMembers, computeMergedRestrictionsForMembers } from "@/lib/family-utils";
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
  const [step, setStep] = useState<"days" | "who">("days");
  const [showGenerator, setShowGenerator] = useState(false);
  // Day currently shown in the plan view (index into DAYS), defaults to today
  const [viewDay, setViewDay] = useState<number>(() => (new Date().getDay() + 6) % 7);

  const weekKey = getCurrentWeekKey();
  const familyMembers = getFamilyMembers();
  const hasFamilyMembers = familyMembers.length > 0;
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => familyMembers.map((m) => m.id));

  const existingPlanDays = useMemo(
    () => (plan ? DAYS.map((d, i) => (plan.plan[d] ? i : -1)).filter((i) => i >= 0) : []),
    [plan],
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    const existing = getCurrentPlan();
    const missing = DAYS.map((_, i) => i).filter((i) => !existing?.plan?.[DAYS[i]]);
    return missing.length ? missing : DAYS.map((_, i) => i);
  });

  const toggleDay = (idx: number) =>
    setSelectedDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]));
  const toggleMember = (id: string) =>
    setSelectedMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const generateLabel = useMemo(() => {
    if (selectedDays.length === 0) return "Select days to generate";
    if (selectedDays.length === 7) return "Generate full week";
    if (selectedDays.length <= 2) return `Generate ${selectedDays.map((i) => DAYS[i]).join(" & ")}`;
    return `Generate ${selectedDays.length} days`;
  }, [selectedDays]);

  const generatePlan = useCallback(async (planMode: "individual" | "family") => {
    if (selectedDays.length === 0) { toast.error("Select at least one day"); return; }
    setMode(planMode);
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
        language: localStorage.getItem("appLanguage") || localStorage.getItem("nouri:language") || "en",
        selectedDays,
      };

      if (planMode === "family") {
        const chosen = familyMembers.filter((m) => selectedMemberIds.includes(m.id));
        body.familyMode = true;
        body.familyRestrictions = computeMergedRestrictionsForMembers(chosen);
        body.householdSize = chosen.length + 1;
      }

      const { data, error } = await supabase.functions.invoke("plan-meals", { body });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      if (!data?.plan) throw new Error("The planner returned no meals. Please try again.");

      // Merge the new days into the existing plan, keeping the days not selected
      const mergedPlan = { ...(getCurrentPlan()?.plan ?? {}) };
      selectedDays.forEach((dayIdx) => {
        const dayName = DAYS[dayIdx];
        if (data.plan[dayName]) mergedPlan[dayName] = data.plan[dayName];
      });

      const newPlan: WeeklyPlan = {
        weekKey,
        plan: mergedPlan,
        createdAt: new Date().toISOString(),
        mode: planMode,
      };
      savePlan(newPlan);
      setPlan(newPlan);
      setViewDay(Math.min(...selectedDays));
      setStep("days");
      setShowGenerator(false);
      toast.success("Meal plan generated!");
    } catch (e: any) {
      console.error("Plan generation failed:", e);
      toast.error(e?.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }, [goals, weekKey, selectedDays, selectedMemberIds, userProfile, familyMembers]);

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
        language: localStorage.getItem("appLanguage") || localStorage.getItem("nouri:language") || "en",
      };

      if (plan.mode === "family") {
        const chosen = familyMembers.filter((m) => selectedMemberIds.includes(m.id));
        body.familyMode = true;
        body.familyRestrictions = computeMergedRestrictionsForMembers(chosen.length ? chosen : familyMembers);
        body.householdSize = (chosen.length || familyMembers.length) + 1;
      }

      const { data, error } = await supabase.functions.invoke("plan-meals", { body });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      if (data?.swapped) {
        updateMealInPlan(day, slot, data.swapped);
        setPlan(getCurrentPlan());
        toast.success("Meal swapped!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Swap failed");
    } finally {
      setSwapping(null);
    }
  }, [plan, goals, familyMembers, selectedMemberIds]);

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
    setSelectedDays(DAYS.map((_, i) => i));
    setStep("days");
  };

  const handleDeleteDay = (dayIdx: number) => {
    if (!plan) return;
    const next = { ...plan.plan };
    delete next[DAYS[dayIdx]];
    const updated: WeeklyPlan = { ...plan, plan: next };
    savePlan(updated);
    setPlan(updated);
    toast.success(`${DAYS[dayIdx]} removed from plan`);
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

      {/* Generator wizard: step 1 = which days, step 2 = who (only when family members exist) */}
      {!generating && (!plan || showGenerator) && (
        <div className="space-y-4">
          {step === "days" && (
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-primary" /> Which days do you want to plan?
              </h2>
              <div className="flex justify-between mb-3">
                <button onClick={() => setSelectedDays(DAYS.map((_, i) => i))} className="text-xs text-primary font-semibold">Select all</button>
                <button onClick={() => setSelectedDays([])} className="text-xs text-muted-foreground">Clear</button>
              </div>
              <div className="flex justify-between mb-5">
                {DAYS.map((dayName, idx) => (
                  <button
                    key={dayName}
                    onClick={() => toggleDay(idx)}
                    aria-label={dayName}
                    aria-pressed={selectedDays.includes(idx)}
                    className={`relative w-10 h-10 rounded-full text-sm font-bold border-2 transition-all flex items-center justify-center
                      ${selectedDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}
                      ${existingPlanDays.includes(idx) ? "ring-2 ring-green-200" : ""}`}
                  >
                    {dayName[0]}
                  </button>
                ))}
              </div>
              <button
                disabled={selectedDays.length === 0}
                onClick={() => (hasFamilyMembers ? setStep("who") : generatePlan("individual"))}
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {hasFamilyMembers ? "Next: who is this for?" : generateLabel}
              </button>
            </div>
          )}

          {step === "who" && hasFamilyMembers && (
            <div>
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <Users size={16} className="text-primary" /> Who is this for?
              </h2>
              <p className="text-xs text-muted-foreground mb-3">{generateLabel}</p>
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Family members to include</div>
                <div className="flex gap-2 flex-wrap">
                  {familyMembers.map((member) => {
                    const selected = selectedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                          ${selected ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"}`}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => generatePlan("individual")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors"
                >
                  <User size={18} className="text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Just for me</div>
                    <div className="text-[11px] text-muted-foreground">Based on your personal profile</div>
                  </div>
                </button>
                <button
                  disabled={selectedMemberIds.length === 0}
                  onClick={() => generatePlan("family")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors disabled:opacity-40"
                >
                  <Users size={18} className="text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Me and the selected family</div>
                    <div className="text-[11px] text-muted-foreground">{selectedMemberIds.length + 1} people, merged restrictions</div>
                  </div>
                </button>
                <button onClick={() => setStep("days")} className="w-full text-xs text-muted-foreground py-2">Back</button>
              </div>
            </div>
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const missing = DAYS.map((_, i) => i).filter((i) => !existingPlanDays.includes(i));
                  setSelectedDays(missing.length ? missing : DAYS.map((_, i) => i));
                  setStep("days");
                  setShowGenerator((v) => !v);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
              >
                <CalendarDays size={12} /> Plan days
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
              >
                <RefreshCw size={12} /> New plan
              </button>
            </div>
          </div>

          {/* Day tabs: click between days */}
          <div role="tablist" aria-label="Plan days" className="flex justify-between">
            {DAYS.map((dayName, idx) => {
              const hasPlan = existingPlanDays.includes(idx);
              const active = viewDay === idx;
              return (
                <button
                  key={dayName}
                  role="tab"
                  aria-selected={active}
                  aria-label={dayName}
                  onClick={() => setViewDay(idx)}
                  className={`relative w-10 h-12 rounded-2xl text-sm font-bold border transition-all flex flex-col items-center justify-center
                    ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}
                >
                  {dayName[0]}
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${hasPlan ? (active ? "bg-primary-foreground" : "bg-green-400") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          {(() => {
            const day = DAYS[viewDay];
            const dayPlan = plan.plan[day];
            if (!dayPlan) {
              return (
                <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
                  <div className="text-sm font-semibold">{day}</div>
                  <p className="text-xs text-muted-foreground">No meals planned for this day yet.</p>
                  <button
                    onClick={() => { setSelectedDays([viewDay]); setStep("days"); setShowGenerator(true); }}
                    className="text-xs text-primary font-semibold"
                  >
                    Plan {day}
                  </button>
                </div>
              );
            }
            const totals = MEAL_SLOTS.reduce(
              (acc, slot) => {
                const m = (dayPlan as any)[slot] as PlannedMeal | undefined;
                return { calories: acc.calories + (m?.calories ?? 0), protein: acc.protein + (m?.protein ?? 0) };
              },
              { calories: 0, protein: 0 },
            );
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium text-foreground">{day}</h3>
                  <span className="text-xs text-muted-foreground">{Math.round(totals.calories)} kcal · {Math.round(totals.protein)}g P</span>
                </div>
                {MEAL_SLOTS.map((slot) => {
                  const meal = (dayPlan as any)[slot] as PlannedMeal | undefined;
                  if (!meal) return null;
                  const isSwapping = swapping === `${day}:${slot}`;
                  return (
                    <div key={slot} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
                            disabled={swapping !== null}
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
                      {meal.why && <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{meal.why}</p>}
                    </div>
                  );
                })}
                <button onClick={() => handleDeleteDay(viewDay)} className="w-full text-xs text-muted-foreground py-2">
                  Delete {day}
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
