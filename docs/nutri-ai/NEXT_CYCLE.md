# Nutri AI Next Cycle

Active stage:
- Stage 038: AI response shimmer
- Objective: Add a subtle shimmer sweep to the pending assistant bubble while a job is running, plus tighter copy.
- Exact files:
  - `src/components/nouri/chat/MessageList.tsx`
  - `src/index.css`
  - `docs/nutri-ai/NEXT_CYCLE.md`
- Verification:
  - `npm.cmd run typecheck`
- Rollback:
  - Remove the shimmer overlay div and the `nouri-shimmer` keyframe.

Previous stage (done):
- Stage 037: Scientific coach tone
- Objective: Add a calmer evidence-style coach tone that reuses the existing rule-engine output, with no new medical logic.
- Exact files:
  - `src/lib/nutri-ai-coach-state.ts`
  - `src/lib/nutri-ai-coach.ts`
  - `src/components/nouri/CoachCard.tsx`
  - `docs/nutri-ai/NEXT_CYCLE.md`
- Verification:
  - `npm.cmd run typecheck`
- Rollback:
  - Remove the new "scientific" CoachTone variant and its copy in CoachCard / nutri-ai-coach.

Priority check before new feature work:
- Verify typed and voice vague-meal clarification in the running app.
- Tighten coach safety copy only if the logging flow remains build-stable.

Recommended next stages:
- Stage 037: Scientific coach tone. Add a calmer evidence-style presentation mode using the same safe rule-engine output.
- Stage 038: AI response shimmer. Add a subtle smart-feeling shimmer/progress treatment to assistant responses while a job is running.
- Stage 021: Food Logging UX polish. Keep this to small copy/state improvements around typed and voice meal entry, especially vague-meal clarification and confirmation states. Do not change nutrient target calculations.
- Stage 022: Today screen polish. Review the weekly date strip, historical totals, water tracker, and streak freeze badge together in the running app, then fix only visible layout or confusing state issues.
- Stage 023: CoachCard and "Why?" copy pass. Make explanations clearer and safer without changing medical logic or recommendation rules.
- Stage 024: Next-best-action buttons. Add or refine simple contextual actions after coach feedback, meal logging, and plan generation, using existing handlers where possible.
- Stage 025: Health profile editing follow-up. Audit profile editing gaps and create a small implementation plan before changing profile or family-member data behavior.

Backlog guardrails:
- Keep each stage scoped to 1-3 files where possible.
- Prefer UI scaffolds and clearer copy over architecture changes.
- Do not calculate new recommended nutrient targets.
- Do not change medical logic unless a later stage explicitly justifies it.
