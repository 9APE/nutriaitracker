# Stage 016: Persistent Shopping List From Weekly Plan

## Goal
After generating a weekly meal plan, user can open a shopping list, leave the page, and come back later.

## User Request
Once generated a plan for a week, user can click shopping list and return later without losing it.

## Scope
- Inspect plan/shopping list state.
- Persist generated shopping list in localStorage or existing storage.
- Add simple open/close shopping list UI if needed.
- Do not rebuild whole planner.

## Files To Inspect
- src/components/nouri/PlanScreen.tsx
- src/lib/nouri-storage.ts
- any shopping-list helpers if they exist

## Acceptance
- Shopping list persists after leaving Plan page.
- User can reopen it.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed. Shopping lists are now persisted per plan week in localStorage, while preserving the existing legacy storage fallback. Verification passed with `npm.cmd run typecheck`.
