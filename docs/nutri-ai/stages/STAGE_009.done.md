# Stage 009: Email Verification Code Flow

## Goal
Require users to verify their email before entering the app.

## User Request
After account creation, the user receives an email with a randomly generated code. They must enter this code into the app before they can continue.

## Scope
- Inspect current auth/signup flow.
- Use Supabase/email capability if already available.
- If full email sending is too large, scaffold a safe verification-code flow and document the missing backend piece.
- Add UI for entering the code.
- Block app access until verified.

## Files To Inspect
- src/pages/Auth.tsx
- src/lib/auth-context.tsx
- src/pages/Index.tsx
- supabase/functions if relevant

## Acceptance
- New users cannot access the main app until verified.
- Verification UI exists.
- If backend email sending cannot be fully completed, code is safely scaffolded and documented.

## Verification Command
npm.cmd run typecheck

## Completion Note
- Added a signup-generated 6-digit email verification code in Supabase user metadata.
- Added an app-level verification gate that blocks newly flagged users until the code is entered.
- Backend email delivery is scaffolded but not wired; the verification screen documents the temporary setup code until an email sender is added.
- Verification passed with `npm.cmd run typecheck`.
