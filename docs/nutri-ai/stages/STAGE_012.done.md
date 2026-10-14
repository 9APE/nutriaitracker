# Stage 012: Family-Aware Meal Plan Personalisation

## Goal
Make generated meal plans consider included family members and their restrictions.

## User Request
If one person is vegetarian and others eat meat, the plan should create a shared meal with personalised swaps, e.g. chicken for meat eaters and tofu for vegetarian person.

## Scope
- Inspect meal planning prompt/function.
- Add included family members into the planner context.
- Ask AI to produce shared base meal plus per-person swaps.
- Do not hard-code diet rules in UI.

## Files To Inspect
- src/components/nouri/PlanScreen.tsx
- supabase/functions/plan-meals/index.ts
- supabase/functions/recommend-meals/index.ts
- profile family member data structure

## Acceptance
- Plan generation prompt includes selected family members.
- Prompt asks for personalised alternatives/swaps.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed 2026-05-09. Planner family mode now builds merged restrictions from the selected included family members, and the plan-meals prompt asks for shared base meals with per-person swaps for mixed household diets. Verification passed with `npm.cmd run typecheck`.
