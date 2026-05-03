
# Mega Feature Plan — Family, Planner, Shopping, Alerts, Recipes, Country Guidelines

This is a very large feature set. I recommend implementing it across **multiple rounds** to keep changes reviewable and testable. Below is the full plan organized by block, in the recommended build order.

---

## Round 1: Family Profiles + Merged Restrictions (Blocks 3 & 4)

### Block 3 — Family Profiles

**New files:**
- `src/components/nouri/FamilySection.tsx` — Settings sub-section with "My Family" card list and "+ Add family member" button
- `src/components/nouri/FamilyMemberOnboarding.tsx` — Shortened AI chat onboarding for a family member (name, age, sex, height, weight, goals, conditions, restrictions, allergies, activity, dislikes). Calls the existing `onboarding-chat` edge function with a "family member" flag to calculate personalized targets via Mifflin-St Jeor.
- `src/components/nouri/FamilyMemberCard.tsx` — Displays name, age, condition/restriction badges, edit/delete actions

**Modified files:**
- `src/lib/family-utils.ts` — Extend `FamilyMember` interface with `height, weight, goals, dailyTargets, activityLevel, dislikes, preferences`. Add household size getter/setter. Already has `getFamilyMembers()`, `saveFamilyMembers()`, `getMergedFamilyRestrictions()`.
- `src/components/nouri/SettingsScreen.tsx` — Add the FamilySection component and household size dropdown (1-8)

### Block 4 — Merged Family Dietary Rules

Already partially implemented in `family-utils.ts`. Enhancements:
- Auto-regenerate merged restrictions on any profile add/edit/delete
- Store as `familyMergedRestrictions` in localStorage
- `FamilyRestrictionsSummary.tsx` already exists — enhance to show the merged rules more prominently
- Inject merged object into all family-mode API calls (plan-meals, suggest-meals, recommend-meals, nutrition-chat)

---

## Round 2: Weekly Meal Planner + Grocery List (Blocks 5 & 6)

### Block 5 — Weekly Meal Planner

**New files:**
- `src/components/nouri/PlanScreen.tsx` — 7-day calendar with breakfast/lunch/dinner/snack slots. "Generate my week" button with mode selector (Me / Family). Swap button per meal slot. Save to recipe library button.
- `src/components/nouri/MealPlanCard.tsx` — Individual meal card showing name, prep time, ingredients, macros, condition badges, swap/save buttons. Family mode shows per-member portions.
- `src/lib/nouri-meal-plan.ts` — localStorage helpers for `weeklyMealPlan` keyed by Monday date, keeps last 4 weeks

**Modified files:**
- `src/components/nouri/TabBar.tsx` — Add "Plan" tab (CalendarDays icon) between History and Insights, making it 6 tabs
- `src/pages/Index.tsx` — Add PlanScreen routing, update TabKey type
- `supabase/functions/plan-meals/index.ts` — Already exists and works. Enhance family mode to include per-member portion calculations (70% for <12, 50% for <6). Add saved recipe incorporation.

### Block 6 — Grocery List

**New files:**
- `src/components/nouri/GroceryList.tsx` — Categorized shopping list with checkboxes, manual add, delete, share (clipboard export)
- `src/lib/nouri-grocery.ts` — Consolidation logic (dedup, quantity summing, category mapping)

**Modified files:**
- `src/components/nouri/PlanScreen.tsx` — "Generate shopping list" button at top when a plan exists
- New edge function `supabase/functions/generate-grocery-list/index.ts` — already exists; verify it handles family mode quantity scaling

---

## Round 3: Recipe Library (Block 7)

**New files:**
- `src/components/nouri/RecipeLibrary.tsx` — Saved recipes view with filters (meal type, dietary badge, prep time, protein, calories) and sort (recent, rated, protein, calories)
- `src/components/nouri/RecipeCard.tsx` — Recipe display with macros, condition badges, rating, "Add to plan" button
- `src/lib/nouri-recipes.ts` — localStorage CRUD for saved recipes, sourced from Recommends, Plan, or rated meals

**Modified files:**
- `src/components/nouri/PlanScreen.tsx` — "Recipes" button to access library; "Add to plan" assigns recipe to a day/slot
- `src/components/nouri/NouriRecommends.tsx` — Add save button on each card
- `src/components/nouri/MealCard.tsx` — Auto-save meals rated with the heart emoji to recipes

---

## Round 4: Condition Alerts + Country Guidelines (Blocks 1 & 2)

### Block 1 — Condition-Specific Micronutrient Alerts

The `CONDITION_NUTRIENT_MAP` in `condition-alerts.ts` already covers most conditions listed in the spec. Enhancements:
- Add missing conditions/nutrients per spec (Vitamin D/Magnesium/B12 for Diabetes with Metformin note, Chromium, Vitamin E, Vitamin K, B6, B1, Vitamin A, Folic acid for Celiac)
- Create a **pinned alert card** component at top of micronutrient section showing condition name, at-risk nutrients as amber/green pill badges, reason sentence, source link
- Add end-of-day nudge for unmet critical nutrients
- Update all AI system prompts to include condition-to-nutrient mapping

### Block 2 — Country-Specific Guidelines

`country-guidelines.ts` already exists with AU, DE, FR, GB, US, IN, OTHER. Enhancements:
- Add country selector step to `ProfileChatOnboarding.tsx` after language selection
- Save to `userProfile.country` (already in the UserProfile interface)
- Inject country guidelines into the onboarding-chat goal calculation prompt
- Show "Why these goals?" in Settings with the authority name and reasoning

---

## Round 5: Family Toggle + Polish (Block 8)

**Modified files:**
- `src/components/nouri/TodayScreen.tsx` — Add Me/Family toggle. Family mode shows combined household progress + mini-cards per member
- `src/components/nouri/InsightsScreen.tsx` — Family mode shows per-member trend charts
- `src/components/nouri/NouriRecommends.tsx` — Family mode changes prompt to "What should I cook for the whole family?"
- `src/components/nouri/PlanScreen.tsx` — Already has family mode from Block 5

### Block 9 — Future Sync TODO

Add TODO comments in `family-utils.ts`, `nouri-meal-plan.ts`, `nouri-recipes.ts`, and `nouri-grocery.ts` for Supabase migration with real-time sync.

---

## Technical Notes

- **Edge functions**: `plan-meals` already uses Anthropic. The spec references Claude for meal planning — will continue using the existing Anthropic integration for plan-meals. Other new AI calls (family member onboarding) will use the Lovable AI gateway.
- **No database changes needed** — all data stays in localStorage per the spec (Block 9 defers Supabase sync).
- **Tab bar**: Going from 5 to 6 tabs. Grid changes from `grid-cols-5` to `grid-cols-6`.
- **All existing functionality preserved** — blocks are additive.

---

## Recommended Approach

Given the size (~15+ new files, ~20 modified files), I suggest we build this **one round at a time**. Approve this plan and I'll start with **Round 1 (Family Profiles + Merged Restrictions)**. After each round we can verify before moving to the next.
