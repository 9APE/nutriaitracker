# Stage 001: Fix Build/Typecheck Reliability

## Goal

Make the app build and typecheck reliably before any UX or feature polish.

## Scope

- Identify the smallest blocker set preventing build/typecheck success.
- Fix only build, type, import, or config issues required for reliable checks.
- Edit 1-3 files max.

## Out of Scope

- Food logging UX changes.
- Today screen changes.
- CoachCard polish.
- "Why?" copy updates.
- Next-best-action buttons.
- Health profile editing changes.
- Medical logic or nutrient target calculations.

## Acceptance

- Build command completes successfully.
- Typecheck command completes successfully.
- No unrelated app behavior is changed.

## Completion Note

Completed on 2026-05-08. Added a reliable build wrapper and typecheck script; `npm.cmd run build` and `npm.cmd run typecheck` pass.
