# Stage 017: Background Action Messaging For Nutri AI

## Goal
When the user sends a Nutri AI message and leaves the page, it should be obvious the action continues in the background.

## User Request
Do not say “you can leave.” It should be obvious that if the user leaves and comes back, the task continues.

## Scope
- Improve chat/action pending state copy.
- Add persistent in-progress state if already available.
- Make wording natural and subtle.
- Do not overcomplicate background jobs.

## Files To Inspect
- src/components/nouri/NouriChatScreen.tsx
- src/hooks/useNouriChat.ts
- src/lib/nouri-api.ts

## Acceptance
- Pending AI actions have clearer status wording.
- User can leave/return without confusing copy.
- Typecheck passes.

## Verification Command
npm.cmd run typecheck

## Completion Note
Completed Stage 017. Updated pending Nutri AI action wording to subtly indicate background work, reused the existing persisted active_job_id state for in-progress chat jobs, and verified with npm.cmd run typecheck.
