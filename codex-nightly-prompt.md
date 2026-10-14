You are working on the Nutri AI / Nouri nutrition app.

Run exactly ONE improvement cycle, then stop.

The goal:
Make Nutri AI feel like a safe, personalised AI nutritionist that checks the user’s nutrition every day, understands goals and conditions, and gives useful personalised advice.

Important:
- Do NOT calculate recommended nutrient intakes.
- The app already calculates recommended min/max targets.
- Your job is the personalised nutritionist layer, condition-colour rule logic, AI prompt layer, Today screen experience, scheduler, feedback loop, and safety guardrails.
- Use the condition-colour nutrition rule database as the source of truth.
- Do not hard-code medical assumptions in React UI components.
- The AI should explain the rule engine result, not invent nutrition logic.
- Medical-condition rules override body-composition goals.
- Do not diagnose, prescribe, shame, or encourage dangerous restriction.
- Do not use weight-loss language for eating-disorder recovery mode.
- Do not push directly to main.
- Keep changes focused. Do not rewrite the whole app.

Cycle:

1. READ
Inspect the repository, especially:
- src/lib/nutri-ai*
- src/lib/nutri-ai-coach*
- src/components/nouri/CoachCard.tsx
- src/components/nouri/TodayScreen.tsx
- src/data/nutri-ai
- docs/nutri-ai/NEXT_CYCLE.md
- docs/nutri-ai/NIGHTLY_PLAN.md
- docs/nutri-ai/NIGHTLY_CRITIQUE.md

2. PLAN
Create or update:
docs/nutri-ai/NIGHTLY_PLAN.md

The plan must include:
- what currently feels weak or generic
- what a real nutritionist would do better
- the ONE focused improvement for this cycle
- exact files to edit
- acceptance criteria
- safety risks to avoid

3. IMPLEMENT
Implement exactly one focused improvement.

Good possible improvements:
- better personalised nutritionist check-in logic
- better nutrient colour evaluation
- better condition-aware priority ranking
- better AI prompt builder
- better Today screen coach card
- better check-in scheduler
- better user feedback loop: dismiss / not helpful / too strict / too generic
- better meal-window logic
- better end-of-day review
- better onboarding/profile condition handling
- better safety guardrails
- better explanation of why nutrient is GREEN / ORANGE / RED

Rules:
- Keep changes clean and focused.
- Do not break existing functionality.
- Do not hard-code medical condition logic in UI components.
- Use the condition-colour rule database where possible.
- If a needed database file is missing, create a small safe scaffold and document it.
- Add or update tests when logic changes.
- Keep UI simple and useful.
- The user should feel: “Here is what matters right now.”
- The user should not feel: “Here are 40 things wrong with me.”

4. VERIFY
Run:
npm run build

If tests exist, run the relevant test command too.

If the build fails:
- fix the build
- rerun it
- do not commit broken code

5. DOCUMENT
Update:
docs/nutri-ai/NIGHTLY_CRITIQUE.md

Include:
- what improved
- what still feels bad, generic, unsafe, or not personalised enough
- what a real nutritionist would do better
- what competitor apps likely do better
- what should be researched next
- what should be the next cycle’s improvement
- build/test result

Update:
docs/nutri-ai/NEXT_CYCLE.md

Write only the single best next task for the next cycle.

6. STOP
Stop after one cycle. Do not start another cycle yourself.
The PowerShell loop will call you again.
