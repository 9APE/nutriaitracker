import { CalendarDays, Check, ChevronRight, Loader2, Mic, ScanLine, Send, Sparkles, Square, TriangleAlert, Users } from "lucide-react";
import { useCountUp, useSteps, useTyping } from "./hooks";
import {
  AppHeader,
  Bubble,
  CalorieRing,
  MacroCard,
  PhoneFrame,
  StatRow,
  StreakPill,
  TabBar,
  Toast,
  WeekStrip,
  Waveform,
  type CursorState,
  type TabId,
} from "./PhoneMock";

export interface SceneProps {
  reduced: boolean;
}

const GOAL = 2984;

/** Shared Today screen: counts up to the given consumed numbers once `run` is true. */
function TodayBody({ run, reduced, kcal, protein, carbs, fat, banner, children }: {
  run: boolean; reduced: boolean; kcal: number; protein: number; carbs: number; fat: number; banner?: string; children?: React.ReactNode;
}) {
  const k = useCountUp(kcal, run, 1200, reduced);
  const p = useCountUp(protein, run, 1200, reduced);
  const c = useCountUp(carbs, run, 1200, reduced);
  const f = useCountUp(fat, run, 1200, reduced);
  return (
    <div className="space-y-3 px-4 pb-20 pt-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[19px] font-bold tracking-tight">NutriAI</div>
          <div className="font-mono-data text-[9px] text-muted-foreground">Wednesday, October 14, 2026</div>
        </div>
        <StreakPill days={run && kcal ? 1 : 0} />
      </div>
      <WeekStrip />
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <CalorieRing consumed={k} goal={GOAL} />
        <StatRow consumed={k} goal={GOAL} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MacroCard label="Protein" value={p} goal={190} color="hsl(var(--macro-protein))" />
        <MacroCard label="Carbs" value={c} goal={336} color="hsl(var(--macro-carbs))" />
        <MacroCard label="Fat" value={f} goal={105} color="hsl(var(--macro-fat))" />
      </div>
      {banner && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 p-2.5 text-[11px]">
          <Sparkles size={14} className="shrink-0 text-primary" /> {banner}
        </div>
      )}
      {children}
    </div>
  );
}

/* =====================================================================
   Scene 1: Log a meal by voice (click Log Meal, talk, "Log it", see it on Today)
   ===================================================================== */
export const LOG_MEAL_MS = 11500;
const LOG_TIMES = [0, 900, 1900, 2200, 3000, 3800, 7100, 8500, 9000];
const LOG_SPEECH = "I had a grilled chicken salad with olive oil for lunch";

export function LogMealScene({ reduced }: SceneProps) {
  const s = useSteps(LOG_TIMES, reduced);
  const listening = s === 5;
  const heard = useTyping(LOG_SPEECH, s >= 5, 20, reduced);
  const onLog = s >= 3 && s < 8;
  const tab: TabId = onLog ? "log" : "today";
  const cursor: CursorState = {
    target: s === 1 || s === 2 ? "tab-log" : s >= 3 && s <= 5 ? "mic" : s === 6 || s === 7 ? "logit" : null,
    pulse: s === 2 ? 1 : s === 5 ? 2 : s === 7 ? 3 : 0,
  };
  return (
    <PhoneFrame cursor={cursor}>
      <AppHeader />
      <Toast show={s >= 8}>
        <span className="flex items-center gap-1.5"><Check size={13} className="text-primary" /> Logged Grilled chicken salad</span>
      </Toast>
      {!onLog ? (
        <div className="h-[calc(100%-48px)] overflow-hidden">
          <TodayBody run={s >= 8} reduced={reduced} kcal={520} protein={42} carbs={18} fat={31} />
        </div>
      ) : (
        <div className="space-y-2 px-4 pt-4">
          <div className="text-[20px] font-semibold">Log a Meal</div>
          <div className="text-[11px] text-muted-foreground">Tap the mic and describe what you ate. I'll do the math.</div>
          <div className="flex flex-col items-center pt-2">
            <span
              data-t="mic"
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-primary-foreground shadow-lg transition-colors ${listening ? "bg-destructive" : "bg-primary"}`}
            >
              {listening ? <Square size={24} /> : <Mic size={28} />}
            </span>
            {listening ? <Waveform active className="mt-2" /> : <div className="mt-2 text-[10px] text-muted-foreground">{s >= 6 ? "Done" : "Tap to start recording"}</div>}
            {!listening && s < 6 && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
                <ScanLine size={12} /> Scan Barcode
              </span>
            )}
          </div>
          <div className="space-y-2 pt-1">
            <Bubble role="user" show={s >= 5}>{heard || "…"}</Bubble>
            <Bubble role="ai" show={s >= 6}>
              Got it: <b>Grilled chicken salad</b> (Lunch). ~ <b>520 kcal</b>, 42g protein, 18g carbs, 31g fat.
              <div
                data-t="logit"
                className={`mt-2 rounded-lg bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-primary-foreground transition-transform ${s === 7 ? "scale-95" : ""}`}
              >
                Log it
              </div>
            </Bubble>
          </div>
        </div>
      )}
      <TabBar active={tab} />
    </PhoneFrame>
  );
}

/* =====================================================================
   Scene 2: Ask AI by voice, get a personalised lunch
   ===================================================================== */
export const ASK_AI_MS = 11000;
const ASK_TIMES = [0, 900, 1800, 2300, 3100, 3700, 7000, 8300, 9300];
const ASK_QUESTION = "What should I eat for lunch to hit my protein goal and lower fat?";

export function AskAiScene({ reduced }: SceneProps) {
  const s = useSteps(ASK_TIMES, reduced);
  const onChat = s >= 3;
  const speaking = s === 5;
  const heard = useTyping(ASK_QUESTION, s >= 5, 24, reduced);
  const cursor: CursorState = {
    target: s === 1 || s === 2 ? "tab-ask" : s === 4 || s === 5 ? "ask-mic" : s === 7 || s === 8 ? "recipe" : null,
    pulse: s === 2 ? 1 : s === 5 ? 2 : s === 8 ? 3 : 0,
  };
  return (
    <PhoneFrame cursor={cursor}>
      <AppHeader />
      {!onChat ? (
        <div className="h-[calc(100%-48px)] overflow-hidden">
          <TodayBody run reduced={reduced} kcal={1180} protein={69} carbs={96} fat={58} />
        </div>
      ) : (
        <div className="flex h-[calc(100%-48px)] flex-col px-4 pb-[68px] pt-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles size={14} /></span>
            Ask Nutri AI
          </div>
          <div className="mt-3 flex-1 space-y-2 overflow-hidden">
            <Bubble role="user" show={s >= 5}>{heard || "…"}</Bubble>
            {s === 6 && (
              <div className="showcase-glow flex items-center gap-2 rounded-2xl border border-primary/30 bg-card px-3 py-2 text-[11px] text-muted-foreground">
                <Loader2 size={13} className="animate-spin text-primary" /> Nutri AI is thinking…
              </div>
            )}
            {s >= 7 && (
              <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-2">
                <Bubble role="ai">Here's a lunch that closes your protein gap and keeps fat low:</Bubble>
                <div className="rounded-2xl border border-primary/25 bg-card p-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold">Lemon herb salmon bowl</div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">-22% fat</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                    {[["540", "kcal"], ["46g", "protein"], ["38g", "carbs"], ["18g", "fat"]].map(([v, l]) => (
                      <div key={l} className="rounded-lg bg-muted/60 py-1.5">
                        <div className="font-mono-data text-[12px] font-bold">{v}</div>
                        <div className="text-[8px] text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">Covers 24% of your daily protein goal.</div>
                  <div
                    data-t="recipe"
                    className={`mt-2 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      s >= 8 ? "scale-95 bg-primary/15 text-primary" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {s >= 8 ? <><Check size={12} /> Recipe ready</> : "Generate Recipe"}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-3">
            <div className="flex-1 text-[11px] text-muted-foreground">
              {speaking ? <Waveform active bars={18} className="h-5" /> : "Ask about your nutrition…"}
            </div>
            <span data-t="ask-mic" className={`flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground ${speaking ? "bg-destructive" : "bg-primary"}`}>
              {speaking ? <Square size={13} /> : <Mic size={14} />}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><Send size={13} /></span>
          </div>
        </div>
      )}
      <TabBar active={onChat ? "ask" : "today"} />
    </PhoneFrame>
  );
}

/* =====================================================================
   Scene 3: Calorie & nutrient tracking with numbers counting up
   ===================================================================== */
export const TRACK_MS = 8500;
const TRACK_TIMES = [0, 600, 3400];

export function TrackScene({ reduced }: SceneProps) {
  const s = useSteps(TRACK_TIMES, reduced);
  const sodium = useCountUp(1840, s >= 1, 1500, reduced);
  const potassium = useCountUp(2025, s >= 1, 1500, reduced);
  return (
    <PhoneFrame cursor={{ target: null, pulse: 0 }}>
      <AppHeader />
      <div className="h-[calc(100%-48px)] overflow-hidden">
        <TodayBody
          run={s >= 1}
          reduced={reduced}
          kcal={2035}
          protein={139}
          carbs={213}
          fat={72}
          banner={s >= 2 ? "Recommended intake calculated from your personal health metrics." : undefined}
        >
          <div className="grid grid-cols-2 gap-2">
            <MacroCard label="Sodium" value={sodium} goal={2300} unit="mg" color="hsl(var(--macro-carbs))" />
            <MacroCard label="Potassium" value={potassium} goal={4700} unit="mg" color="hsl(var(--macro-water))" />
          </div>
        </TodayBody>
      </div>
      <TabBar active="today" />
    </PhoneFrame>
  );
}

/* =====================================================================
   Scene 4: Smart sodium alert + instant AI fix
   ===================================================================== */
export const ALERT_MS = 10000;
const ALERT_TIMES = [0, 700, 2600, 5200, 7200];

export function AlertScene({ reduced }: SceneProps) {
  const s = useSteps(ALERT_TIMES, reduced);
  const sodium = useCountUp(5275, s >= 1, 1600, reduced);
  const over = sodium > 2300;
  const meals = [
    ["🌅", "Bacon & egg roll", "620 kcal", "1,480 mg"],
    ["☀️", "Ramen noodle bowl", "780 kcal", "2,950 mg"],
    ["🍎", "Salted crisps", "310 kcal", "845 mg"],
  ];
  return (
    <PhoneFrame cursor={{ target: null, pulse: 0 }}>
      <AppHeader />
      <Toast show={s >= 2 && s < 4} tone="warning">
        <span className="flex items-start gap-1.5"><TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span><b>Sodium Notice:</b> Today, you've gone over your recommended sodium intake.</span>
        </span>
      </Toast>
      <div className="space-y-3 px-4 pb-20 pt-3">
        <div className="text-[19px] font-bold tracking-tight">Today's log</div>
        <div className="space-y-1.5">
          {meals.map(([e, n, k, na], i) => (
            <div key={n} className={`flex items-center gap-2 rounded-xl border border-border bg-card p-2 transition-all duration-500 ${s >= 1 || i === 0 ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: `${i * 150}ms` }}>
              <span className="text-base">{e}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium">{n}</div>
                <div className="text-[9px] text-muted-foreground">{k}</div>
              </div>
              <span className="font-mono-data text-[10px] text-muted-foreground">{na}</span>
            </div>
          ))}
        </div>
        <MacroCard label="Sodium" value={sodium} goal={2300} unit="mg" color="hsl(var(--macro-carbs))" over={over} />
        {s >= 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-2 rounded-2xl border border-primary/25 bg-primary/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary"><Sparkles size={13} /> Nutri AI suggestion</div>
            <div className="text-[11px]">Here's a low-sodium dinner suggestion to balance your day.</div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2">
              <div>
                <div className="text-[12px] font-semibold">Herb-baked cod & quinoa</div>
                <div className="text-[9px] text-muted-foreground">480 kcal · 41g protein · <b className="text-primary">210 mg sodium</b></div>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all ${s >= 4 ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}>
                {s >= 4 ? "Logged ✓" : "Log it"}
              </span>
            </div>
          </div>
        )}
      </div>
      <TabBar active="today" />
    </PhoneFrame>
  );
}

/* =====================================================================
   Scene 5: Weekly meal plan, pick days then click between them
   ===================================================================== */
export const PLAN_MS = 11500;
const PLAN_TIMES = [0, 800, 1700, 2100, 3000, 3600, 4400, 5000, 5800, 6400, 7300, 8300, 9100, 9900, 10700];
const PLAN_DAYS = ["Monday", "Tuesday", "Wednesday"] as const;
const PLAN_MEALS: Record<string, [string, string][]> = {
  Monday: [["🌅", "Greek yogurt & berries"], ["☀️", "Chicken quinoa bowl"], ["🌙", "Baked salmon & greens"], ["🍎", "Apple & almonds"]],
  Tuesday: [["🌅", "Veggie omelette"], ["☀️", "Turkey & hummus wrap"], ["🌙", "Lentil curry"], ["🍎", "Cottage cheese"]],
  Wednesday: [["🌅", "Overnight oats"], ["☀️", "Tuna salad bowl"], ["🌙", "Tofu stir fry"], ["🍎", "Protein smoothie"]],
};

export function PlanScene({ reduced }: SceneProps) {
  const s = useSteps(PLAN_TIMES, reduced);
  const onPlan = s >= 3;
  const picked = s >= 8 ? 3 : s >= 6 ? 2 : s >= 4 ? 1 : 0;
  const generating = s === 10;
  const showPlan = s >= 11;
  const viewDay = s >= 14 ? 2 : s >= 12 ? 1 : 0;
  const cursor: CursorState = {
    target:
      s === 1 || s === 2 ? "tab-plan"
      : s === 3 || s === 4 ? "pick-0"
      : s === 5 || s === 6 ? "pick-1"
      : s === 7 || s === 8 ? "pick-2"
      : s === 9 || s === 10 ? "generate"
      : s === 11 || s === 12 ? "view-1"
      : s >= 13 ? "view-2"
      : null,
    pulse: s === 2 ? 1 : s === 4 ? 2 : s === 6 ? 3 : s === 8 ? 4 : s === 10 ? 5 : s === 12 ? 6 : s === 14 ? 7 : 0,
  };
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <PhoneFrame cursor={cursor}>
      <AppHeader />
      {!onPlan ? (
        <div className="h-[calc(100%-48px)] overflow-hidden">
          <TodayBody run reduced={reduced} kcal={640} protein={52} carbs={64} fat={21} />
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-20 pt-4">
          {!showPlan && !generating && (
            <>
              <div className="flex items-center gap-2 text-[14px] font-semibold"><CalendarDays size={15} className="text-primary" /> Which days do you want to plan?</div>
              <div className="flex justify-between">
                {letters.map((l, i) => (
                  <span
                    key={i}
                    data-t={`pick-${i}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-all ${
                      i < picked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {l}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Users size={11} /> You'll be asked who it's for only if you have family members.</div>
              <div data-t="generate" className="rounded-xl bg-primary py-2.5 text-center text-[12px] font-semibold text-primary-foreground">
                {picked === 0 ? "Select days to generate" : `Generate ${picked} day${picked === 1 ? "" : "s"}`}
              </div>
            </>
          )}
          {generating && (
            <div className="flex flex-col items-center gap-2 py-24 text-[12px] text-muted-foreground">
              <Loader2 className="animate-spin text-primary" size={26} /> Generating your meal plan…
            </div>
          )}
          {showPlan && (
            <div className="animate-in fade-in duration-500 space-y-2.5">
              <div className="flex justify-between">
                {letters.map((l, i) => (
                  <span
                    key={i}
                    data-t={`view-${i}`}
                    className={`flex h-11 w-9 flex-col items-center justify-center rounded-2xl border text-[12px] font-bold transition-all ${
                      i === viewDay ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {l}
                    <span className={`mt-0.5 h-1 w-1 rounded-full ${i === viewDay ? "bg-primary-foreground" : i < 3 ? "bg-green-400" : "bg-transparent"}`} />
                  </span>
                ))}
              </div>
              <div key={viewDay} className="animate-in fade-in slide-in-from-right-3 duration-300 space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[12px] font-medium">
                  {PLAN_DAYS[viewDay]} <span className="font-mono-data text-[10px] text-muted-foreground">2,010 kcal · 158g P</span>
                </div>
                {PLAN_MEALS[PLAN_DAYS[viewDay]].map(([e, n], i) => (
                  <div key={n} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                    <span className="text-base">{e}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{["breakfast", "lunch", "dinner", "snack"][i]}</div>
                      <div className="truncate text-[12px] font-medium">{n}</div>
                    </div>
                    <ChevronRight size={13} className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <TabBar active={onPlan ? "plan" : "today"} />
    </PhoneFrame>
  );
}
