import { useState, useCallback, useMemo, useEffect } from "react";
import { CalendarDays, RefreshCw, ShoppingCart, BookOpen, Loader2, Users, User } from "lucide-react";
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
import { computeMergedRestrictionsFromMembers, getFamilyMembers, type FamilyMember } from "@/lib/family-utils";
import { GroceryList } from "@/components/nouri/GroceryList";
import { RecipeLibrary } from "@/components/nouri/RecipeLibrary";
import type { Goals } from "@/lib/nouri-storage";
import { getFamilyContext } from "@/lib/family-context";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";


interface Props {
  goals: Goals;
  userProfile?: any;
}

const getMealEmoji = (mealType: string): string => {
  switch (mealType) {
    case "breakfast": return "🌅";
    case "lunch": return "☀️";
    case "dinner": return "🌙";
    default: return "🍎";
  }
};

const DAY_ABBR = ["M", "T", "W", "T", "F", "S", "S"];

function normalizePlanFamilyMember(value: any): FamilyMember | null {
  const profile = value?.profile && typeof value.profile === "object" ? value.profile : {};
  const name = typeof value?.name === "string" && value.name.trim()
    ? value.name.trim()
    : typeof profile.name === "string" && profile.name.trim()
      ? profile.name.trim()
      : "";
  if (!name) return null;

  return {
    id: String(value?.member_id ?? value?.id ?? profile.id ?? crypto.randomUUID()),
    name,
    restrictions: Array.isArray(profile.restrictions) ? profile.restrictions.map(String) : [],
    conditions: Array.isArray(profile.conditions) ? profile.conditions.map(String) : [],
    allergies: Array.isArray(profile.allergies) ? profile.allergies.map(String) : [],
    dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.map(String) : [],
    cuisinePreferences: Array.isArray(profile.cuisinePreferences) ? profile.cuisinePreferences.map(String) : [],
  };
}

export function PlanScreen({ goals, userProfile }: Props) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(() => getCurrentPlan());
  const [generating, setGenerating] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [mode, setMode] = useState<"individual" | "family">("individual");
  const [view, setView] = useState<"plan" | "grocery" | "recipes">("plan");
  // Which day's meals are showing in the plan view (index into DAYS)
  const [step, setStep] = useState<"days" | "who">("days");
  const [showGenerator, setShowGenerator] = useState(false);
  const [viewDay, setViewDay] = useState<number>(() => (new Date().getDay() + 6) % 7);
  // Day & member selection state
  const existingPlanDays = useMemo(() => {
    if (!plan) return [] as number[];
    return DAYS.map((d, i) => (plan.plan[d] ? i : -1)).filter((i) => i >= 0);
  }, [plan]);

  const missingDays = useMemo(
    () => DAYS.map((_, i) => i).filter((i) => !existingPlanDays.includes(i)),
    [existingPlanDays]
  );

  const [selectedDays, setSelectedDays] = useState<number[]>(() =>
    DAYS.map((_, i) => i).filter((i) => !existingPlanDays.includes(i))
  );

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => getFamilyMembers());
  const hasFamilyMembers = familyMembers.length > 0;
  const weekKey = getCurrentWeekKey();

  const allMemberIds = useMemo(() => familyMembers.map((m) => m.id), [familyMembers]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    getFamilyMembers().map((m) => m.id)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFamilyMembers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("family_members")
        .select("id, member_id, name, profile")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error || cancelled) return;

      const cloudMembers = (data ?? [])
        .map(normalizePlanFamilyMember)
        .filter((member): member is FamilyMember => Boolean(member));

      if (cloudMembers.length > 0) {
        setFamilyMembers(cloudMembers);
        setSelectedMemberIds((prev) => {
          const validIds = cloudMembers.map((member) => member.id);
          const selected = prev.filter((id) => validIds.includes(id));
          return selected.length > 0 ? selected : validIds;
        });
      }
    }

    void loadFamilyMembers();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      const selected = prev.filter((id) => allMemberIds.includes(id));
      return selected.length > 0 || allMemberIds.length === 0 ? selected : allMemberIds;
    });
  }, [allMemberIds]);

  const toggleDay = (idx: number) =>
    setSelectedDays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
  };

  const generateLabel = useMemo(() => {
    if (selectedDays.length === 0) return "Select days to generate";
    if (selectedDays.length === 7) return "Generate full week";
    if (selectedDays.length <= 2)
      return `Generate ${selectedDays.map((i) => DAYS[i]).join(" & ")}`;
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
        language: localStorage.getItem("appLanguage") || "en",
        cuisinePreferences: profile?.cuisinePreferences ?? [],
        selectedDays,
        selectedFamilyMemberIds: selectedMemberIds,
        nutritionistContext: buildNutritionistContext({
          meals: [],
          goals,
          userProfile: profile,
        }).aiContext,
      };

      if (planMode === "family") {
        const { data: { user } } = await supabase.auth.getUser();
        const family = await getFamilyContext(profile, user?.id);
        const selectedMembers = family.memberProfiles.filter((member) => selectedMemberIds.includes(member.id));
        body.familyMode = true;
        body.familyRestrictions = computeMergedRestrictionsFromMembers(profile, selectedMembers);
        body.familyMembers = selectedMembers;
        body.householdSize = selectedMembers.length + 1;
      }

      const { data, error } = await supabase.functions.invoke("plan-meals", { body });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      if (!data?.plan) throw new Error("The planner returned no meals. Please try again.");

      // Merge new days into existing plan, preserving unselected days
      const existing = getCurrentPlan();
      const mergedPlan = { ...(existing?.plan ?? {}) };
      if (data.plan) {
        selectedDays.forEach((dayIdx) => {
          const dayName = DAYS[dayIdx];
          if (data.plan[dayName]) mergedPlan[dayName] = data.plan[dayName];
        });
      }

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
  }, [goals, weekKey, selectedDays, selectedMemberIds, userProfile]);

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
        language: localStorage.getItem("appLanguage") || "en",
        nutritionistContext: buildNutritionistContext({
          meals: [],
          goals,
          userProfile: profile,
        }).aiContext,
      };

      if (plan.mode === "family") {
        const { data: { user } } = await supabase.auth.getUser();
        const family = await getFamilyContext(profile, user?.id);
        body.familyMode = true;
        body.familyRestrictions = family.mergedRestrictions;
        body.familyMembers = family.memberProfiles;
        body.householdSize = family.householdSize;
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
  }, [plan, goals]);

  const handleGenerateNew = () => {
    clearCurrentPlan();
    setPlan(null);
    setSelectedDays(DAYS.map((_, i) => i));
    setStep("days");
  };

  const handleDeleteDay = (dayIdx: number) => {
    if (!plan) return;
    const day = DAYS[dayIdx];
    const newPlanData = { ...plan.plan };
    delete newPlanData[day];
    const updated: WeeklyPlan = { ...plan, plan: newPlanData };
    savePlan(updated);
    setPlan(getCurrentPlan());
    toast.success(`${day} removed from plan`);
  };

  if (view === "grocery") {
    return <GroceryList plan={plan} onBack={() => setView("plan")} />;
  }

  if (view === "recipes") {
    return <RecipeLibrary onBack={() => setView("plan")} />;
  }

  return (
    <div className="px-4 pt-4 pb-36 max-w-md mx-auto space-y-4">
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
      {!generating && (plan === null || showGenerator) && (
        <div className="space-y-4">
          {step === "days" && (
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-primary" /> Which days do you want to plan?
              </h2>

              <div className="flex justify-between mb-3">
                <button onClick={() => setSelectedDays(DAYS.map((_, i) => i))}
                  className="text-xs text-primary font-semibold">Select all</button>
                <button onClick={() => setSelectedDays([])}
                  className="text-xs text-muted-foreground">Clear</button>
              </div>

              <div className="flex justify-between mb-5">
                {DAY_ABBR.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    aria-label={DAYS[idx]}
                    aria-pressed={selectedDays.includes(idx)}
                    className={`relative w-10 h-10 rounded-full text-sm font-bold border-2 transition-all flex flex-col items-center justify-center
                      ${selectedDays.includes(idx)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border"
                      }
                      ${existingPlanDays.includes(idx) ? "ring-2 ring-green-200" : ""}
                    `}
                  >
                    {day}
                    {existingPlanDays.includes(idx) && (
                      <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
                    )}
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
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                          ${selected
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted border-border text-muted-foreground"
                          }`}
                        aria-pressed={selected}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <button onClick={() => generatePlan("individual")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors">
                  <User size={18} className="text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Just for me</div>
                    <div className="text-[11px] text-muted-foreground">Based on your personal profile</div>
                  </div>
                </button>
                <button
                  disabled={selectedMemberIds.length === 0}
                  onClick={() => generatePlan("family")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 bg-card transition-colors disabled:opacity-40">
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
          <p className="text-[11px] text-muted-foreground">this may take 15-30 seconds</p>
        </div>
      )}

      {plan && !generating && (
        <>
          {/* Top actions bar */}
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
                onClick={handleGenerateNew}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
              >
                <RefreshCw size={12} /> New plan
              </button>
              <button
                onClick={() => { setSelectedDays(missingDays.length ? missingDays : DAYS.map((_, i) => i)); setStep("days"); setShowGenerator((v) => !v); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:border-primary/40 transition-colors"
              >
                <CalendarDays size={12} /> Plan days
              </button>
            </div>
          </div>

          {/* Day tabs: click between days */}
          <div role="tablist" aria-label="Plan days" className="flex justify-between">
            {DAY_ABBR.map((abbr, idx) => {
              const hasPlan = existingPlanDays.includes(idx);
              const active = viewDay === idx;
              return (
                <button
                  key={idx}
                  role="tab"
                  aria-selected={active}
                  aria-label={DAYS[idx]}
                  onClick={() => setViewDay(idx)}
                  className={`relative w-10 h-12 rounded-2xl text-sm font-bold border transition-all flex flex-col items-center justify-center
                    ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}
                >
                  {abbr}
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
                    onClick={() => { setSelectedDays([viewDay]); toast("Tap the generate button above to plan this day"); }}
                    className="text-xs text-primary font-semibold"
                  >
                    Select {day} to generate
                  </button>
                </div>
              );
            }
            const dayTotals = MEAL_SLOTS.reduce(
              (acc, slot) => {
                const m = (dayPlan as any)[slot] as PlannedMeal | undefined;
                return { calories: acc.calories + (m?.calories ?? 0), protein: acc.protein + (m?.protein ?? 0) };
              },
              { calories: 0, protein: 0 },
            );
            return (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{day}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(dayTotals.calories)} kcal · {Math.round(dayTotals.protein)}g P
                  </span>
                </div>

                <div className="divide-y divide-border">
                  {MEAL_SLOTS.map((mealType) => {
                    const meal = (dayPlan as any)[mealType] as PlannedMeal | undefined;
                    const isSwapping = swapping === `${day}:${mealType}`;
                    return (
                      <div key={mealType} className="px-4 py-3 flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{getMealEmoji(mealType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{mealType}</div>
                          <div className="font-semibold text-sm truncate">{meal?.meal_name || "Not planned"}</div>
                          <div className="text-xs text-muted-foreground">
                            {meal ? `${meal.calories} kcal · ${meal.protein}g P` : ""}
                          </div>
                        </div>
                        {meal && (
                          <button
                            onClick={() => handleSwap(day, mealType)}
                            disabled={swapping !== null}
                            className="text-primary text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                          >
                            {isSwapping ? <Loader2 size={12} className="animate-spin" /> : "Swap"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-muted/40 px-4 py-2 border-t border-border flex">
                  <button className="flex-1 text-primary text-xs font-semibold" onClick={() => handleDeleteDay(viewDay)}>
                    Delete day
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
