# Nouri UX Polish Tasks
# Run with: claude --dangerously-skip-permissions "Read tasks-ux.md and complete every task in order..."

---

## Task 11 — FAB Menu Dots Animation

### Context
The floating action button (+ button) needs visual polish. When user presses it, three menu option dots should appear to the side, slightly transparent, indicating there are multiple logging methods available.

### Files to find
- The floating action button component (likely in Layout.tsx, MainNav.tsx, or wherever the FAB is defined)
- The LogOptions bottom sheet component

### Exact changes required

1. The current FAB is a simple circle with a + icon. Keep that as the base.

2. When the FAB is NOT active (resting state):
```tsx
<button
  onClick={() => setShowLogOptions(true)}
  className="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-accent text-white shadow-lg flex items-center justify-center text-2xl z-20 transition-all hover:shadow-xl"
>
  +
</button>
```

3. When the FAB IS active OR the LogOptions sheet is open, display three dots to the LEFT of the FAB button that appear with a staggered animation:

```tsx
{showLogOptions && (
  <>
    {/* Three dots menu - staggered animation */}
    <button
      onClick={() => startVoice()}
      className="fixed bottom-20 right-20 w-10 h-10 rounded-full bg-accent text-white shadow-md flex items-center justify-center text-lg opacity-70 hover:opacity-100 transition-all animate-in fade-in slide-in-from-right-4 duration-200"
      style={{ animationDelay: '0ms' }}
      title="Voice logging"
    >
      🎤
    </button>
    
    <button
      onClick={() => openChat()}
      className="fixed bottom-28 right-12 w-10 h-10 rounded-full bg-accent text-white shadow-md flex items-center justify-center text-lg opacity-70 hover:opacity-100 transition-all animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{ animationDelay: '50ms' }}
      title="Type or chat"
    >
      ⌨️
    </button>
    
    <button
      onClick={() => openFoodDatabase()}
      className="fixed bottom-36 right-5 w-10 h-10 rounded-full bg-accent text-white shadow-md flex items-center justify-center text-lg opacity-70 hover:opacity-100 transition-all animate-in fade-in slide-in-from-left-4 duration-200"
      style={{ animationDelay: '100ms' }}
      title="Browse food database"
    >
      🔍
    </button>
  </>
)}
```

4. The three dots should:
- Be 10px smaller than the main FAB (40px instead of 56px)
- Have opacity set to 0.7 (slightly transparent as you requested)
- Show an emoji icon (🎤 for voice, ⌨️ for type, 🔍 for browse)
- Appear in a triangular pattern around the FAB: one to the left, one to the bottom-left, one to the top-left
- Animate in with a staggered delay so they don't all appear at once
- Have hover state that increases opacity to 1.0
- Have a slightly smaller shadow than the main FAB

5. Closing the FAB (when showLogOptions becomes false) should reverse the animation with a fade-out.

6. The LogOptions bottom sheet is still shown, but now the user can tap the dots directly instead of only having the sheet. Both paths work.

### Verification
Tap the + FAB. Verify three dots appear in sequence with slight delays. Verify they are transparent (opacity 0.7). Verify on hover they become more opaque. Verify tapping each dot triggers the correct action. Verify dots disappear when sheet closes.

### Git commit message
"feat: FAB menu dots - staggered animation, transparency, three logging shortcuts"

---

## Task 12 — Meal Plan Visual Redesign (Minimal & Optimized)

### Context
The current meal plan visual in the Plan tab is cluttered and hard to scan. It needs to be completely redesigned to be minimal, easy to understand at a glance, and optimized for quick meal browsing.

### Files to find
- Plan tab component (Plan.tsx, WeeklyPlan.tsx, MealPlanView.tsx or similar)
- Any component that renders individual meal cards or the day/meal grid
- The day selector from Task 6 (reuse that component)

### Exact changes required

1. The meal plan should display as a CLEAN WEEK GRID showing only the essential information:

```
┌─ MONDAY ─────────────────────┐
│ 🥣 Breakfast                 │
│ Oatmeal with berries         │
│ 380 kcal · 12g P             │
│                              │
│ 🌞 Lunch                     │
│ Grilled chicken & rice       │
│ 680 kcal · 48g P             │
│                              │
│ 🍽️ Dinner                    │
│ Salmon with vegetables       │
│ 550 kcal · 42g P             │
└──────────────────────────────┘
```

Each day card should:
- Have a subtle background (white or very light stone)
- Show the day name prominently at the top in a muted color
- Show three meal sections (Breakfast, Lunch, Dinner) with emoji icons
- Each meal shows: meal name, calories, and protein in ONE LINE
- No extra details, no descriptions, no clutter
- Meal names should be truncated if longer than 30 characters with ellipsis
- Cards should stack vertically on mobile

2. The layout structure:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
  {selectedDays.map(dayIdx => (
    <div key={dayIdx} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      
      {/* Day header */}
      <div className="bg-stone-50 px-4 py-3 border-b border-stone-100">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {DAY_NAMES[dayIdx]}
        </span>
      </div>
      
      {/* Meals */}
      <div className="divide-y divide-stone-100">
        {['breakfast', 'lunch', 'dinner'].map(mealType => (
          <div key={mealType} className="px-4 py-3 flex items-center gap-3">
            <span className="text-lg flex-shrink-0">{getMealEmoji(mealType)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-stone-900 truncate">
                {mealPlan[dayIdx]?.[mealType]?.name || 'Not planned'}
              </div>
              <div className="text-xs text-muted-foreground">
                {mealPlan[dayIdx]?.[mealType]?.calories || 0} kcal · {mealPlan[dayIdx]?.[mealType]?.protein || 0}g P
              </div>
            </div>
            <button onClick={() => editMeal(dayIdx, mealType)} className="text-accent text-xs font-semibold">
              Edit
            </button>
          </div>
        ))}
      </div>
      
      {/* Card footer with actions */}
      <div className="bg-stone-50 px-4 py-2 border-t border-stone-100 flex gap-2 text-xs">
        <button className="flex-1 text-accent font-semibold">Swap meals</button>
        <button className="flex-1 text-accent font-semibold">Delete day</button>
      </div>
    </div>
  ))}
</div>
```

3. Each meal name is tappable (shows tap visual feedback). Tapping opens a quick menu:
- "Change meal" — opens a modal to pick a different meal
- "Swap with another day" — lets user move this meal to a different day
- "Remove" — delete this meal from the plan

4. The "Swap meals" button at the bottom of each day card opens a UI to:
- Pick another day
- Choose if you want to swap entire day or just one meal
- Confirm swap

5. Colors and spacing:
- Use the exact same green accent (#2D6A4F) for buttons and edit links
- Generous vertical padding (py-3) between meals
- No shadows, just subtle borders
- Font sizes: 12px for labels, 14px for meal names, 11px for macros
- Icons should be exactly 18px (one emoji character)

6. The entire week of 7 days should fit on one screen when scrolled. On smaller screens (mobile), show 1-2 days per row. Use Tailwind grid-cols-1 lg:grid-cols-2.

7. Add "Generate new plan" button at the very top that goes back to the day/member selector from Task 6.

### Verification
Open the Plan tab. Verify meal plan displays in a clean grid. Verify you can read each day's meals at a glance without scrolling within a card. Verify tapping meal names lets you edit. Verify the entire plan is scannable in under 5 seconds.

### Git commit message
"feat: meal plan visual redesign - minimal grid layout, one-line meals, optimized for scanning"

---

## Task 13 — Language Selection Only on First Signup

### Context
Currently the language selection screen appears every time the user logs in. It should only appear once on first signup/app startup, not on subsequent logins.

### Files to find
- The app's main routing/authentication component (App.tsx, auth.tsx, or similar)
- The language selection screen component (LanguagePicker.tsx or similar)
- The onboarding flow component (ProfileChatOnboarding.tsx or similar)
- Supabase profiles table where user preferences are stored

### Exact changes required

1. Add a column to the Supabase profiles table called "language_selected" (boolean, default false):

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS language_selected boolean NOT NULL DEFAULT false;
```

2. In the authentication flow (right after user creates an account), run this migration:
```bash
npx supabase db push
```

3. Update the app routing logic in App.tsx or the main shell component:

```typescript
function AppShell() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const [appLanguage, setAppLanguage] = useState(localStorage.getItem('appLanguage') || 'en')
  
  // Check if this is a new user (has just signed up)
  const isNewUser = profile && !profile.language_selected
  
  // If new user, show language picker FIRST before anything else
  if (isNewUser) {
    return (
      <LanguagePicker
        onLanguageSelected={async (language) => {
          setAppLanguage(language)
          localStorage.setItem('appLanguage', language)
          
          // Mark language as selected in the profile
          await supabase
            .from('profiles')
            .update({ language_selected: true })
            .eq('id', user.id)
        }}
      />
    )
  }
  
  // If profile is incomplete (no health conditions set), show onboarding
  if (profile && !profile.onboarding_complete) {
    return <ProfileChatOnboarding />
  }
  
  // Otherwise show the normal app
  return <MainApp />
}
```

4. The LanguagePicker component should:
- Show a simple grid of 10 language options as large tappable buttons
- Each button shows the flag emoji and language name
- On selection, save to localStorage AND update the profile.language_selected field
- Auto-dismiss and proceed to onboarding (if needed) or main app

5. For returning users, the language selector should still be accessible in Settings under a "Language" button, but it should NOT appear on login.

6. Add a check during login: if user comes back and language_selected is true, skip the language picker entirely and go straight to checking if onboarding is complete.

### Verification
Create a brand new account. Verify language picker appears first. Select a language. Verify you proceed to onboarding or main app, NOT back to language picker. Log out and log back in. Verify language picker does NOT appear again. Verify language setting is still the one you selected before.

### Git commit message
"fix: language selection only on first signup, not on every login"

---

## Final Step After All Tasks Complete

```bash
git add .
git commit -m "chore: tasks 11-13 complete - FAB menu dots, meal plan redesign, language fix"
git push origin main
```

Verify Lovable has auto-synced at nutriaitracker.lovable.app
