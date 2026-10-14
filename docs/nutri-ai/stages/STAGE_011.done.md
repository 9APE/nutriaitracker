# Stage 011: Family Member Selector On Plan Page

## Goal
On the Plan page, show family member names under the day selector and let users include/exclude each person for meal planning.

## User Request
Family members should not only be hidden in settings. Under the days at the top, show each family member name and allow clicking them on/off.

## Scope
- Inspect PlanScreen and profile family member structure.
- Add a family member selector below day tabs.
- Keep state local or use existing profile structure.
- Do not rewrite planner architecture.

## Files To Inspect
- src/components/nouri/PlanScreen.tsx
- src/lib/nouri-cloud.ts
- profile/userProfile types

## Acceptance
- Family member chips appear on Plan page if family members exist.
- User can toggle included family members.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed. Added a Plan page family member chip selector below the day tabs, loading cloud family members when available and using the selected members for family plan generation. Verified with `npm.cmd run typecheck`.
