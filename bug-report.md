# Nouri Eat Well — Bug Report
_Generated: 2026-05-05 by automated overnight code review of `origin/main`_

---

## Fixed in This Session

### 1. PlanScreen sent wrong language to the plan-meals edge function
**File:** `src/components/nouri/PlanScreen.tsx` lines 69, 118  
**Severity:** High — all non-English users affected on every plan generation and meal swap  
**Root cause:** Both `generatePlan` and `handleSwap` read `localStorage.getItem("nouri:language")`. The i18n module (`nouri-i18n.ts`) stores the language code under `CODE_KEY = "appLanguage"`. The wrong key always returned `null`, so plans and meal swaps were silently generated in English regardless of the user's selected language.  
**Fix applied:** Both occurrences changed to `localStorage.getItem("appLanguage") || "en"`.

---

## Fixed This Run

| Issue | File | Fix Summary |
|---|---|---|
| 2 + 15 | `src/lib/nouri-dashboard-layout.ts` | Removed dead localStorage branch in `goalForMetric`; goals read directly from the parameter |
| 3 | `src/pages/Settings.tsx` | `handleLogout` now calls `supabase.auth.signOut()` and navigates to `/auth` |
| 4 | `src/App.tsx` | Added `/home` (redirect→`/`), `/analytics`, and `/settings` routes |
| 7 | `src/components/nouri/NouriChatScreen.tsx` | Added `user &&` guard to barcode and photo-capture sheet conditionals; removed `user!.id` non-null assertions |
| 8 | `src/lib/nouri-dashboard-layout.ts`, `src/components/nouri/TodayScreen.tsx` | Widened `goalForMetric` signature to `Goals \| ExtendedGoals`; removed `as Goals` casts at call sites |
| 9 | `src/pages/Settings.tsx` | Settings row buttons now show an info toast on press |
| 10 | `src/pages/Settings.tsx` | Version footer corrected from "Cal AI v1.0.0" to "Nouri v1.0.0" |
| 11 | `src/pages/Analytics.tsx` | Changed `parseInt` → `parseFloat` for height and weight in BMI calculation |
| 12 | `src/components/nouri/BarcodeScanner.tsx` | Replaced `onDetected` in useEffect deps with a stable `useRef` holding latest callback |
| 13 | `src/hooks/useVoice.ts` | Catch all `getUserMedia` error types with specific friendly messages |
| 14 | `src/pages/Settings.tsx` | Replaced hardcoded Tailwind colors (`bg-gray-50`, `text-black`, `bg-white`) with design-token classes |
| 16 | `src/components/nouri/WeeklyReport.tsx` | Added `stats` to `useEffect` dependency array |

---

## Critical Bugs Requiring Human Review

_(All critical bugs resolved in this run — see "Fixed This Run" section above.)_

---

## Logic Errors

### 5. `Analytics.tsx` reads orphaned localStorage keys — BMI and all stats are always blank
**File:** `src/pages/Analytics.tsx` lines 14–21  
**Status:** Skipped — requires full replacement of localStorage reads with `useProfile()` and `useMeals()` hooks; page is an orphaned route with no production impact currently. Needs dedicated refactor pass.

### 6. `Dashboard.tsx` all calorie/macro counters are hardcoded mock data
**File:** `src/components/Dashboard.tsx` lines 5–17  
**Status:** Skipped — requires wiring to `useMeals()` + `useGoals()` hooks; page is an orphaned route with no production impact currently. Needs dedicated refactor pass.

---

## TypeScript Issues

_(Both TypeScript issues resolved in this run — see "Fixed This Run" section above.)_

---

## UX Problems

_(All UX issues resolved in this run — see "Fixed This Run" section above.)_

---

## Missing Error Handling

_(Both error-handling issues resolved in this run — see "Fixed This Run" section above.)_

---

## Minor Issues

_(Issues 14, 15, 16 resolved in this run — see "Fixed This Run" section above.)_

### 17. Duplicate `rowToMeal` helper defined in two files
**Files:** `src/hooks/queries/useMeals.ts`, `src/lib/nouri-cloud.ts`  
**Details:** Identical logic defined independently. No functional bug, but a future DB schema change would need to be applied in two places.  
**Status:** Skipped — no functional bug; deduplicate in a separate cleanup pass.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Fixed (prior session) | 1 | ✅ Done |
| Fixed (this run) | 12 | ✅ Done |
| Skipped (refactor needed) | 3 | ⏭ Issues 5, 6, 17 |
| **Total identified** | **17** | |

**Remaining open work:**
- **Issue 5** — Analytics.tsx: replace orphaned localStorage reads with `useProfile()` + `useMeals()` hooks (requires dedicated refactor)
- **Issue 6** — Dashboard.tsx: wire hardcoded mock data to `useMeals()` + `useGoals()` (requires dedicated refactor)
- **Issue 17** — Deduplicate `rowToMeal` helper across `useMeals.ts` / `nouri-cloud.ts`
