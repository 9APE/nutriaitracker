# Return From Revert Plan

Current stable baseline:
- `main` at `7615ffd` (`Fix Nutri AI realtime channel reuse`)

Saved pre-revert snapshot:
- `saved-progress-before-rollback` at `8b816ab` (`Remove legacy verification gate`)

This document explains how we return from the revert safely. It lists:
- what is missing on current `main`
- what we should restore
- what we should not blindly restore
- the order we should use to get back to the richer product
- how Discord feedback fits into the return plan

## Why We Reverted

The richer branch had real product improvements, but it also introduced regressions that broke startup and Nutri AI reliability.

Known causes from the earlier branch family:

1. `profiles.language_selected` was referenced in runtime code, but the live Supabase schema does not have that column.
2. A manual `EmailVerificationGate` was reintroduced and trapped users in a fragile setup path.
3. Nutri AI page stability regressed through runtime issues, including:
   - realtime channel reuse for `ai_jobs`
   - earlier coach-card runtime mistakes
   - root-shell risk concentrated in `src/pages/Index.tsx`
4. Some advanced AI cache work depended on schema and function support that was not safely aligned with the live deployed environment.

## What Current Main Already Has And Must Preserve

These are not missing features. They are part of the current stable base and must remain intact while we reapply richer functionality.

1. Startup and auth-entry stabilization
- no runtime dependency on `profiles.language_selected`
- no manual verification gate in the main shell path

2. Nutri AI screen isolation
- `src/components/nouri/ScreenErrorBoundary.tsx`
- Nutri AI should fail visibly, not blank the page

3. Unique realtime channel naming for `ai_jobs`
- `src/hooks/useAiJobRealtime.ts`
- prevents `cannot add postgres_changes callbacks ... after subscribe()`

4. Stable pushed recovery chain now on `main`
- `1363c91` `Restore stable Nutri AI version`
- `e978c24` `Stabilize Nutri AI screen rendering`
- `7615ffd` `Fix Nutri AI realtime channel reuse`

If a restoration slice breaks any of these, that slice is not ready, even if it restores a wanted feature.

## Evidence Basis For This Plan

This plan is based on the current repo state, not memory.

Comparison used:
- current branch:
  - `main` at `7615ffd`
- saved richer snapshot:
  - `saved-progress-before-rollback` at `8b816ab`
- diff basis:
  - `git diff --name-status 7615ffd..8b816ab`
  - `git diff --stat 7615ffd..8b816ab`

That diff showed:
- the full feedback and Discord stack exists in the saved branch and is missing from current `main`
- the Me, hydration, Nutri AI action, cache, and live voice work is also missing from current `main`
- some saved-branch code must not be reapplied literally, because `main` now contains newer stability fixes that post-date the revert

## Missing Feature Inventory

These are the main feature families present in `8b816ab` and absent from current `main`.

### A. Feedback system and Discord delivery

Missing:
- fullscreen feedback prompt
- every-third-open prompt cadence before first submission
- monthly follow-up prompt cadence after submission
- Settings entry for always-available feedback
- Me page feedback CTA
- owner-only feedback stats endpoint
- `submit-feedback` flow with Discord-first delivery
- client direct Discord fallback via `VITE_DISCORD_WEBHOOK`
- rollout checker script
- feedback persistence tests

Key files from saved branch:
- `src/components/nouri/FeedbackPrompt.tsx`
- `src/lib/feedback-prompt.ts`
- `src/lib/feedback-prompt.test.ts`
- `src/lib/feedback-prompt-cadence.test.ts`
- `scripts/feedback-rollout-check.mjs`
- `supabase/functions/feedback-prompt-state/index.ts`
- `supabase/functions/feedback-stats/index.ts`
- `supabase/functions/submit-feedback/index.ts`
- `supabase/functions/_shared/feedback-prompt.ts`
- `supabase/migrations/20260529120000_feedback_submissions.sql`

Important requirements:
- restore the Discord path explicitly
- keep the behavior where direct Discord send still persists feedback state and cadence

### B. Me page and Daily Signals split

Missing:
- Me/Insights split with a top segmented switch
- stronger check-in-first Me layout
- `DailySignalsCard`
- persisted Me subview mode

Key files:
- `src/components/nouri/MeScreen.tsx`
- `src/components/nouri/DailySignalsCard.tsx`
- `src/hooks/queries/useDailySignals.ts`
- `src/lib/me-section-mode.ts`

### C. Today, hydration, and notification prominence

Missing:
- hydration card and more prominent water tracking
- stronger hydration logic and reminders
- notification settings UI
- visual refresh of Today, History, Insights, and Meal cards
- nutrition display modes (`easy | default | advanced`)

Key files:
- `src/components/nouri/HydrationCard.tsx`
- `src/components/nouri/NotificationSettings.tsx`
- `src/components/nouri/TodayScreen.tsx`
- `src/components/nouri/TodayFocus.tsx`
- `src/components/nouri/HistoryScreen.tsx`
- `src/components/nouri/InsightsScreen.tsx`
- `src/components/nouri/MealCard.tsx`
- `src/lib/nutrition-display-mode.ts`
- `src/lib/nouri-notifications.ts`
- `src/lib/nutri-ai/hydration-estimates.ts`

### D. Nutri AI app-action layer

Missing:
- AI action intent parsing for app actions
- confirmation dialog for AI-triggered actions
- app control actions like settings, history, feedback, water, and tracking mode changes

Key files:
- `src/components/nouri/AiActionConfirmDialog.tsx`
- `src/lib/nutri-ai/app-action-intent.ts`
- `src/lib/nutri-ai/app-action-intent.test.ts`
- `src/lib/nutri-ai/live-action-contract.ts`
- `src/pages/Index.tsx`
- `src/components/nouri/NouriChatScreen.tsx`

### E. Nutri AI reliability, natural-language meal logging, and coaching improvements

Missing:
- stronger message-intent handling for phrases like `I ate ...` and `for lunch ...`
- broader reply guarantees and follow-up polish from the later branch
- coach style preference persistence
- follow-up storage reuse for weekly check-ins and reports
- richer nutritionist context threading

Key files:
- `src/lib/nutri-ai/message-intent.ts`
- `src/lib/nutri-ai/message-intent.test.ts`
- `src/lib/nutri-ai-coach-style.ts`
- `src/lib/nutri-ai-followup-storage.ts`
- `src/lib/nutri-ai-followup-storage.test.ts`
- `src/lib/nutri-ai/nutritionist-context.ts`
- `src/components/nouri/WeeklyCheckin.tsx`
- `src/components/nouri/WeeklyReport.tsx`

### F. Feedback and coach UX in top-level screens

Missing:
- Settings `Send feedback` entry
- Me feedback CTA near the top
- coach-card and top-level UX refinements that were added later

Key files:
- `src/components/nouri/SettingsScreen.tsx`
- `src/components/nouri/MeScreen.tsx`
- `src/components/nouri/CoachCard.tsx`

### G. AI cache, personalization, and metrics system

Missing:
- cache-aware response feedback strip
- cache id extraction and feedback signals
- personalization and template infrastructure
- metrics persistence and stats
- metrics dashboard
- cache-related Supabase functions and migrations

Key files:
- `src/components/nouri/AiResponseFeedback.tsx`
- `src/lib/ai-cache-feedback.ts`
- `src/lib/extractCacheId.ts`
- `src/lib/placeholderTemplate.ts`
- `src/lib/personalization-metrics.ts`
- `src/lib/metrics-persistence.ts`
- `src/lib/metrics-stats.ts`
- `src/components/dev/MetricsDashboard.tsx`
- `supabase/functions/ai-cache-feedback/index.ts`
- `supabase/functions/ai-cache-stats/index.ts`
- `supabase/functions/ai-cache-maintenance/index.ts`
- `supabase/functions/_shared/ai-cache.ts`
- `supabase/migrations/20260509221440_ai_response_cache.sql`
- `supabase/migrations/20260512000000_ai_cache_safety_and_personalization.sql`

Important note:
- this is the highest-risk family to reapply
- some of the historical breakage risk sits near this broader area

### H. Live voice and realtime session experiments

Missing:
- live Nutri AI overlay
- realtime session hooks
- voice session edge functions

Key files:
- `src/components/nouri/NutriAILiveOverlay.tsx`
- `src/components/nouri/LiveVoiceTray.tsx`
- `src/hooks/useLiveNutriAISession.ts`
- `src/hooks/useRealtimeNutriAISession.ts`
- `src/hooks/useLiveNutriTurn.ts`
- `supabase/functions/live-voice-session/index.ts`
- `supabase/functions/live-nutri-turn/index.ts`
- `supabase/functions/realtime-session/index.ts`

Important note:
- this should return only after the regular Nutri AI path is solid again

## Regressions We Must Not Reintroduce

Before reapplying anything from `8b816ab`, keep these guardrails:

1. Do not add runtime references to `profiles.language_selected` unless the matching migration is deployed first.
2. Do not restore the old manual `EmailVerificationGate`.
3. Keep `ai_jobs` realtime channels unique per mounted job watcher.
4. If restoring feedback direct-to-Discord, keep persistence and cadence sync intact.
5. Treat any `cache_id` or AI cache work as schema-coupled. Do not merge it without matching migrations, functions, and runtime checks.
6. Keep screen-level failure isolation for Nutri AI; do not remove the error boundary unless a better guard replaces it.

## Recommended Reapply Order

### Phase 1 - Low-risk, high-value UX recovery

Goal:
- restore obvious product value without touching the riskiest schema-dependent AI cache work

Restore:
1. Settings feedback entry
2. fullscreen feedback prompt
3. Discord-first feedback delivery
4. feedback cadence logic
5. Me page feedback CTA
6. Me/Insights split
7. `DailySignalsCard`
8. hydration card and safer Today polish

Why first:
- these deliver visible value fast
- they are mostly isolated from the Nutri AI core execution path
- Discord feedback is explicitly requested and useful immediately

### Phase 2 - Nutri AI product behavior upgrades

Restore:
1. natural-language meal logging improvements
2. reply-guarantee hardening where still missing
3. coach style preference
4. follow-up storage reuse
5. Me page coaching-first improvements
6. AI action confirmation layer for safe app actions

Why second:
- this improves the core Nutri AI experience
- it builds on the now-stable Nutri AI tab instead of destabilizing it first

### Phase 3 - Visual refresh and richer tracking modes

Restore:
1. nutrition display modes
2. Today, History, and Insights visual refresh
3. hydration notification tuning
4. premium polish in logging and meal surfaces

Why third:
- these are valuable, but they touch many screens
- better to apply them once feedback and core Nutri AI flows are already back

### Phase 4 - Cache, personalization, and metrics reintroduction

Restore carefully:
1. cache response envelopes
2. `cache_id` propagation through chat, suggestions, and plans
3. AI response feedback strip
4. cache feedback signals endpoint
5. metrics persistence and dashboard
6. template personalization

Required before merge:
- verify migrations are present and compatible
- verify runtime consumers tolerate missing cache metadata
- run targeted end-to-end chat and suggestion tests

Why late:
- this is the most architecture-coupled family
- it is the easiest area to break production with subtle schema drift

### Phase 5 - Live voice and realtime experiment return

Restore last:
1. live voice tray
2. realtime session overlay
3. related edge functions

Why last:
- this is additive, not foundational
- it depends on the base Nutri AI experience already being stable

## Concrete Reapply Slices

Use these as PR-sized slices instead of one giant merge.

1. `feedback-discord-foundation`
- restore:
  - `FeedbackPrompt`
  - `feedback-prompt.ts`
  - `submit-feedback`
  - `feedback-prompt-state`
  - `feedback-stats`
  - feedback migration
  - Settings entry
- verify:
  - prompt opens
  - Discord send works
  - submission persists
  - cadence updates

2. `me-signals-split`
- restore:
  - `DailySignalsCard`
  - Me segmented mode
  - Me top-level layout improvements
- verify:
  - switch persists
  - History remains below

3. `hydration-prominence`
- restore:
  - hydration card
  - hydration estimates
  - notification settings
- verify:
  - no Today regressions
  - water target logic stays correct

4. `nutri-ai-action-layer`
- restore:
  - app action intent parsing
  - confirmation dialog
  - selected safe actions first
- verify:
  - no silent failures
  - no page crashes on action results

5. `nutri-ai-coach-upgrades`
- restore:
  - meal intent improvements
  - coach style persistence
  - follow-up storage reuse
  - weekly check-in and report context upgrades

6. `display-mode-refresh`
- restore:
  - Easy, Default, and Advanced presentation layer
  - Today, History, and Insights visual refresh

7. `ai-cache-and-metrics`
- restore only after explicit runtime schema verification

8. `live-voice-return`
- restore last

## Discord Feedback Requirements

Do not forget these when reapplying feedback:

1. Client path:
- `src/lib/feedback-prompt.ts`
- supports direct Discord via `VITE_DISCORD_WEBHOOK`

2. Server path:
- `supabase/functions/submit-feedback/index.ts`
- supports `DISCORD_WEBHOOK`
- supports `skip_delivery` for persistence-only follow-up

3. Product behavior:
- Discord send must not bypass persistence
- feedback submission must still update cadence state
- Settings must always expose feedback
- prompt cadence remains every three opens until first feedback, then monthly

## Recommended First Move

Start with the smallest high-value return:

### First restoration target
- `feedback-discord-foundation`

Why:
- the user explicitly asked not to forget Discord feedback
- it is easier to verify safely than the AI cache stack
- it gives immediate product value and owner visibility
- it does not require destabilizing Nutri AI chat internals first

## Verification Standard For Each Restoration Slice

For every slice:

1. Typecheck
2. Production build
3. Focused unit tests where present
4. Browser verification on the real screen touched
5. If Supabase functions are involved, verify the local fallback and deployed path expectations separately

