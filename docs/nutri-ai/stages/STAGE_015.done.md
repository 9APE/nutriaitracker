# Stage 015: Historical Nutrient View On Today Screen

## Goal
When a past date is selected, Today screen should show that day’s meals and nutrient totals.

## User Request
If user clicks Wednesday last week, all visuals update to Wednesday and show what they ate and nutrient values.

## Scope
- Use selected date from date strip.
- Filter meals by selected date.
- Make calories/macros/micros display selected day values.
- Do not break today default.

## Files To Inspect
- src/components/nouri/TodayScreen.tsx
- src/lib/nouri-nutrient-alerts.ts
- src/lib/nouri-storage.ts

## Acceptance
- Past-day selection changes visible meals and totals.
- Today remains default.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Implemented selected-date nutrient alerts and micronutrient totals on Today screen. Today-only nudges remain visible only for the current day. Verified with `npm.cmd run typecheck`.
