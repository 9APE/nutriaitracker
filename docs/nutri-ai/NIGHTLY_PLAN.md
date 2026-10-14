# Nutri AI Nightly Plan

## This Cycle
Make the app build-stable, then improve only the fast meal logging path.

## Focus
- Vague meal logs should ask one short portion question before estimating.
- Clear meal logs should keep going straight to the nutrition estimate.
- Voice logging should preserve the original meal text when the clarification answer is spoken.

## Acceptance
- `tsc --noEmit` passes.
- `npm run build` passes.
- No medical advice is added in the clarification step.
