# Stage 018: Swipeable Water Tracking Visual

## Goal
Add a swipeable main visual on Today page where the user can switch from calories/protein to water tracking.

## User Request
Swipe right/left from the main visual to water input. Include quick options like glass, bottle, sip.

## Scope
- Add simple water tracking card/visual.
- Add quick input buttons.
- Store water intake for the day locally or existing storage.
- Keep small.

## Files To Inspect
- src/components/nouri/TodayScreen.tsx
- src/lib/nouri-storage.ts

## Acceptance
- User can switch to water visual.
- User can add sip/glass/bottle.
- Water total updates.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed. Added a swipeable water view to the Today focus card, quick-add sip/glass/bottle buttons, and local per-day water intake storage. Verification passed with `npm.cmd run typecheck`.
