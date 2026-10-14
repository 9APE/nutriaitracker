# Stage 014: Swipeable Weekly Date Strip On Today Screen

## Goal
Add a scrollable/swipeable week-by-week date strip to Today page.

## User Request
At the top of Today page, show dated days. User can swipe left/right week by week and click a day.

## Scope
- Add date strip UI.
- Selecting a past day updates visible totals/meals for that day.
- When user leaves Today and comes back, reset to today.
- Keep implementation small.

## Files To Inspect
- src/components/nouri/TodayScreen.tsx
- src/lib/nouri-storage.ts
- src/pages/Index.tsx if selected date must be controlled there

## Acceptance
- User can select days from a week strip.
- Today visuals update to selected day.
- Returning to Today resets to current day.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Implemented a swipeable/clickable weekly date strip on Today. Selecting a date updates visible totals and meals for that day, and Today resets to the current day when remounted. Verification passed with `npm.cmd run typecheck`.
