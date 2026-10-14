# Stage 019: Drink Parsing And Hydration Classification

## Goal
When users log drinks, count water appropriately and handle sugary drinks as sugar, not just hydration.

## User Request
If user says burger and water, count water. If user says Sprite/Fanta, count sugar and only optionally count partial hydration if app supports it.

## Scope
- Inspect meal/chat parsing flow.
- Improve prompt or parsing instructions for drinks.
- Track water only for water/low-sugar drinks.
- Sugary drinks should affect sugar/macro warnings.
- Do not invent medical claims.

## Files To Inspect
- src/hooks/useNouriChat.ts
- supabase/functions/nutrition-chat/index.ts
- src/lib/nouri-nutrient-alerts.ts
- src/lib/nouri-storage.ts

## Acceptance
- Water logs contribute to hydration if supported.
- Sugary drinks are treated primarily as sugar/calories.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed Stage 019. Added drink-specific analyzer instructions so plain water remains identifiable for hydration, while sugary drinks are counted as sugar/calories. Added a small hydration increment when a confirmed chat meal includes plain water. Verification passed with `npm.cmd run typecheck`.
