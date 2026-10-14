# Stage 013: Duolingo-Like Streak Freeze

## Goal
Make levels and streaks feel more like Duolingo, including a streak freeze that can protect the streak if the user misses a day.

## User Request
Users can win a free streak/freeze, and it keeps their streak alive if they miss logging one day.

## Scope
- Inspect existing streak and XP systems.
- Add streak freeze count/state if not present.
- Use a freeze automatically when a day is missed.
- Add simple UI text or badge if possible.

## Files To Inspect
- src/lib/nouri-streak.ts
- src/lib/nouri-xp.ts
- src/components/nouri/XPScreen.tsx
- src/components/nouri/TodayScreen.tsx

## Acceptance
- Streak freeze logic exists.
- Missing one day can consume a freeze and preserve streak.
- User can see freeze status somewhere simple.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
- Confirmed streak freeze storage, milestone awards, and automatic freeze consumption already exist in `src/lib/nouri-streak.ts`.
- Added visible freeze status to the Today streak badge.
- Verification passed: `npm.cmd run typecheck`.
