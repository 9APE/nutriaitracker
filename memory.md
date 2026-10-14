# Memory — Nouri Eat Well

## Architecture Notes (as of 2026-05-06)

- **Auth**: Supabase auth. Session lives in Supabase, not localStorage. Use `supabase.auth.signOut()` for logout.
- **Goals persistence**: Supabase via `useGoals` / `useUpdateGoals` hooks in `src/hooks/queries/useGoals.ts`. No localStorage mirroring. `ExtendedGoals` (from `src/lib/nouri-goals.ts`) extends base `Goals` with micros.
- **Meals persistence**: Supabase via `useMeals` hook in `src/hooks/queries/useMeals.ts`.
- **i18n**: Language stored under key `"appLanguage"` (not `"nouri:language"`). Use `getLanguage()` from `src/lib/nouri-i18n.ts`.
- **Routes**: `App.tsx` defines `/`, `/auth`, `/analytics`, `/settings`. `/home` redirects to `/`. Main app at `/` is `Index.tsx` which uses a `TabBar` (not `BottomNavigation`).
- **BottomNavigation**: Used only in orphaned pages (Analytics, Settings, Dashboard component). Main app uses `TabBar`.
- **Orphaned pages**: `src/components/Dashboard.tsx`, `src/pages/Analytics.tsx`, `src/pages/Settings.tsx` — now routed but still use orphaned localStorage reads for profile data (Issues 5 & 6 pending).
- **Dashboard layout**: `goalForMetric(metric, goals: Goals | ExtendedGoals)` in `nouri-dashboard-layout.ts` — reads goals directly from parameter, no localStorage.
