# Lessons — Nouri Eat Well

## Fix Run: 2026-05-06

### Fixes Applied
- `goalForMetric` in `nouri-dashboard-layout.ts`: dead localStorage block (`todayGoalsDate` / `todayGoals` / `userGoals`) was a relic of a prior architecture; removed it and read goals directly from the function parameter. Widened signature to `Goals | ExtendedGoals`.
- `Settings.tsx` logout: old code cleared a localStorage key (`isLoggedIn`) that was never written; auth state lives in Supabase. Fixed to `supabase.auth.signOut()` + `navigate('/auth')`.
- `App.tsx` missing routes: `BottomNavigation` navigated to `/home`, `/analytics`, `/settings` which were unregistered catch-alls. Added the three routes; `/home` redirects to `/`.
- `NouriChatScreen.tsx` user guard: barcode and photo-capture sheets used `user!.id` without a `user` check on the conditional. Added `user &&` guard and removed non-null assertions.
- `BarcodeScanner.tsx` unstable deps: `onDetected` in useEffect deps caused scanner re-init on every parent render. Fixed by storing latest callback in a `useRef` and removing `onDetected` from deps.
- `useVoice.ts` error handling: only `NotAllowedError` was caught; `NotSupportedError` and others produced unhandled rejections. Fixed with specific message per error type.
- `Analytics.tsx`: `parseInt` → `parseFloat` for height/weight in BMI calculation.
- `Settings.tsx`: hardcoded `bg-gray-50` / `text-black` / `bg-white` replaced with design token classes; "Cal AI v1.0.0" corrected to "Nouri v1.0.0"; dead buttons wired to info toast.
- `WeeklyReport.tsx`: added `stats` to useEffect dependency array.

### Recurring Causes
- **localStorage key mismatch**: Prior architecture stored data under different keys than current code expects. Always verify keys are actually written before trusting localStorage reads.
- **Missing route registration**: Pages created but not added to `App.tsx` routes leave nav items broken. Check `App.tsx` when adding a new page component.
- **Non-null assertions without guards**: `user!.id` style assertions should always be paired with an explicit `user &&` check on the enclosing conditional.

### Mistakes Avoided
- Did not refactor `Analytics.tsx` or `Dashboard.tsx` beyond the scoped `parseFloat` fix — full rewrite requires hook integration and was correctly skipped.
- Did not touch `rowToMeal` duplication (Issue 17) — no functional bug, skip deduplication for a separate pass.
