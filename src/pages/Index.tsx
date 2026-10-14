import { useEffect, useState, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Goals, type Meal, DEFAULT_GOALS, todayISO } from "@/lib/nouri-storage";
import { computeNutrientAlerts, computeDayTotals } from "@/lib/nouri-nutrient-alerts";
import { TabBar, type TabKey } from "@/components/nouri/TabBar";
import { NouriHeader } from "@/components/nouri/NouriHeader";
import { ScreenLoader } from "@/components/nouri/ScreenLoader";
import { NotificationBell } from "@/components/nouri/NotificationBell";
import { MeScreen } from "@/components/nouri/MeScreen";
import { LogOptionsFAB } from "@/components/nouri/LogOptionsFAB";

// Lazy-loaded heavy screens  each becomes its own JS chunk, shrinking the
// initial bundle. Named exports are re-mapped to default for React.lazy.
const TodayScreen = lazy(() =>
  import("@/components/nouri/TodayScreen").then((m) => ({ default: m.TodayScreen }))
);
const PlanScreen = lazy(() =>
  import("@/components/nouri/PlanScreen").then((m) => ({ default: m.PlanScreen }))
);
const NouriChatScreen = lazy(() =>
  import("@/components/nouri/NouriChatScreen").then((m) => ({ default: m.NouriChatScreen }))
);


import { useAutoSuggestions } from "@/hooks/useAutoSuggestions";
import { notifStore } from "@/lib/nouri-suggestions";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/lib/nouri-cloud";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  ProfileChatOnboarding,
  type UserProfile,
} from "@/components/nouri/ProfileChatOnboarding";
import { reconcileStreakOnAppOpen, consumePendingMessage, recordMealLogged } from "@/lib/nouri-streak";
import { awardMealXP, checkDailyGoalAwards } from "@/lib/nouri-xp";
import { XPFloater } from "@/components/nouri/XPFloater";
import { XPScreen } from "@/components/nouri/XPScreen";
import { WeeklyCheckin } from "@/components/nouri/WeeklyCheckin";
import { WeeklyReport } from "@/components/nouri/WeeklyReport";
import { shouldShowWeeklyReport } from "@/lib/nouri-weekly-report";
import { GoalCelebration } from "@/components/nouri/GoalCelebration";
import { GuestLogScreen } from "@/components/nouri/GuestLogScreen";
import { LanguageSelect } from "@/components/nouri/LanguageSelect";
import { SettingsScreen } from "@/components/nouri/SettingsScreen";
import { ScreenErrorBoundary } from "@/components/nouri/ScreenErrorBoundary";
import { FeedbackPrompt } from "@/components/nouri/FeedbackPrompt";
import { getLanguage, getLanguageMeta, useLanguage, t } from "@/lib/nouri-i18n";
import { Settings as SettingsIcon } from "lucide-react";
import { generateLayout, saveLayout, getStoredLayout } from "@/lib/nouri-dashboard-layout";
import { buildExtendedGoals, parseWeightToKg, type ExtendedGoals } from "@/lib/nouri-goals";
import { useMeals, useAddMeal, useDeleteMeal } from "@/hooks/queries/useMeals";
import { useGoals, useUpdateGoals } from "@/hooks/queries/useGoals";
import { useProfile, useUpdateProfile } from "@/hooks/queries/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { fetchFeedbackPromptDecision, type FeedbackPromptDecision } from "@/lib/feedback-prompt";

const Index = () => {
  const { user, loading: authLoading, signOut, isGuest } = useAuth();
  const qc = useQueryClient();

  const profileQ = useProfile();
  const goalsQ = useGoals();
  const mealsQ = useMeals();
  const updateProfile = useUpdateProfile();
  const updateGoals = useUpdateGoals();
  const addMealM = useAddMeal();
  const deleteMealM = useDeleteMeal();

  const profile: Profile | null = profileQ.data ?? null;
  const goals: Goals = goalsQ.data?.base ?? DEFAULT_GOALS;
  const meals: Meal[] = mealsQ.data ?? [];

  const [tab, setTab] = useState<TabKey>("today");
  const [notifKey, setNotifKey] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [logPrefill, setLogPrefill] = useState<{ text: string; source?: "voice" | "text"; autoSend?: boolean } | undefined>(undefined);
  const [chatAutoVoice, setChatAutoVoice] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [feedbackDecision, setFeedbackDecision] = useState<FeedbackPromptDecision | null>(null);
  const [settingsPickLang, setSettingsPickLang] = useState(false);
  const [hasLanguage, setHasLanguage] = useState<boolean>(() => {
    if (localStorage.getItem("nouri:lang-picked")) return true;
    if (getLanguage()) { localStorage.setItem("nouri:lang-picked", "1"); return true; }
    return false;
  });
  const bootstrapping =
    !!user && (profileQ.isLoading || goalsQ.isLoading || mealsQ.isLoading);
  const currentLang = useLanguage();
  const langMeta = getLanguageMeta(currentLang);

  // Derive the chat-onboarding profile and warnings from the profile row.
  const userProfile: UserProfile | null =
    (profile?.user_profile_json as UserProfile | null) ?? null;

  // Onboarding is needed if the profile row has no body stats yet.
  const needsOnboarding = !!user && profileQ.isSuccess && !(
    profile?.age || profile?.weight_kg || profile?.height_cm || profile?.activity_level ||
    userProfile?.age || userProfile?.weight || userProfile?.height || userProfile?.activityLevel
  );

  // Returning users skip the language picker once onboarding/profile data exists.
  // The live backend does not have a `language_selected` column, so we rely on
  // local app state plus existing body stats instead of a missing schema field.
  useEffect(() => {
    const isReturning =
      profile?.age || profile?.weight_kg || profile?.height_cm || profile?.activity_level;
    if (isReturning && !hasLanguage) {
      localStorage.setItem("nouri:lang-picked", "1");
      setHasLanguage(true);
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror warnings into localStorage for legacy readers (one-way only).
  useEffect(() => {
    if (profile?.user_warnings_json && Array.isArray(profile.user_warnings_json)) {
      try {
        localStorage.setItem("userWarnings", JSON.stringify(profile.user_warnings_json));
      } catch {}
    }
  }, [profile?.user_warnings_json]);

  // Reconcile streak on app open
  useEffect(() => {
    if (!user) return;
    reconcileStreakOnAppOpen(user.id);
    const pending = consumePendingMessage(user.id);
    if (pending?.kind === "freeze-used") {
      toast("Streak freeze used. Your  streak is safe  log today to keep it going.", { duration: 6000 });
    } else if (pending?.kind === "streak-ended") {
      toast("Your streak ended  start a new one today.", { duration: 6000 });
    }
    if (!localStorage.getItem("nouri:signupDate")) {
      localStorage.setItem("nouri:signupDate", todayISO());
    }
  }, [user?.id]);

  // Show weekly report once data has loaded.
  useEffect(() => {
    if (!user || isGuest || mealsQ.isLoading) return;
    if (shouldShowWeeklyReport(user.id)) setShowWeeklyReport(true);
  }, [user, isGuest, mealsQ.isLoading]);

  useEffect(() => {
    if (!user?.id || isGuest) return; // no feedback prompts in the temporary preview
    if (authLoading || bootstrapping) return;
    if (needsOnboarding || !userProfile || editingProfile) return;

    const sessionKey = `nouri:feedback-open-counted:${user.id}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");
    } catch {}

    let cancelled = false;
    void fetchFeedbackPromptDecision()
      .then((decision) => {
        if (cancelled || !decision.shouldPrompt) return;
        setFeedbackDecision(decision);
      })
      .catch((error) => {
        console.warn("[feedback-prompt] state fetch failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, bootstrapping, editingProfile, isGuest, needsOnboarding, user?.id, userProfile]);

  // Reset React Query caches on sign-out so a new user doesn't see stale data.
  useEffect(() => {
    if (!user) qc.clear();
  }, [user, qc]);

  // Auto-generate dashboard layout once if missing for an existing user
  useEffect(() => {
    if (!userProfile || isGuest) return; // guests keep the default layout (no AI call)
    if (getStoredLayout(user?.id)) return;
    let cancelled = false;
    (async () => {
      try {
        const layout = await generateLayout({ profile: userProfile, goals });
        if (!cancelled) saveLayout(layout, user?.id);
      } catch (e) {
        console.error("initial layout generation failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, userProfile, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoSuggestions({
    userId: user?.id,
    enabled: !isGuest,
    profile: userProfile ?? null,
    goals,
    meals,
    onNew: () => setNotifKey((k) => k + 1),
  });

  const handleAddMeal = async (m: Meal) => {
    if (!user) return;
    setTab("today");
    const todayKey = todayISO();
    const totalsToday = [m, ...meals.filter((x) => x.date === todayKey)].reduce(
      (a, x) => ({
        calories: a.calories + x.calories,
        protein: a.protein + x.protein,
        carbs: a.carbs + x.carbs,
        fat: a.fat + x.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    checkDailyGoalAwards(totalsToday, goals, user.id);

    // Detect newly-triggered nutrient limit alerts caused by this meal
    const extGoals = goalsQ.data?.extended;
    if (extGoals) {
      const beforeTotals = computeDayTotals(meals);
      const beforeIds = new Set(
        computeNutrientAlerts(beforeTotals, extGoals, userProfile).map((a) => a.id)
      );
      const afterTotals = computeDayTotals([m, ...meals]);
      const newAlert = computeNutrientAlerts(afterTotals, extGoals, userProfile)
        .find((a) => !beforeIds.has(a.id) && (a.level === "exceeded" || a.level === "warning"));
      if (newAlert) {
        toast.warning(`${newAlert.label}: ${newAlert.message}. ${newAlert.advice}`, { duration: 6000 });
      }
    }

    try {
      await addMealM.mutateAsync({
        id: m.id,
        meal_name: m.meal_name,
        type: m.type,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        date: m.date,
        micros: m.micros,
      });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save meal");
      return;
    }

    // Only award XP and update streak once the meal is actually saved.
    awardMealXP(user.id);
    recordMealLogged(user.id);
    checkDailyGoalAwards(totalsToday, goals, user.id);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!user) return;
    await deleteMealM.mutateAsync(id);
  };

  const handleSignOut = async () => {
    const message = isGuest
      ? "Leave the temporary preview? Everything you did here will be discarded."
      : t("signOutConfirm", currentLang);
    if (!confirm(message)) return;
    notifStore.clear(user?.id);
    qc.clear();
    await signOut();
    toast(t("signedOut", currentLang));
  };

  if (authLoading || bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Surface server errors so users can retry instead of seeing an empty app.
  if (profileQ.isError || goalsQ.isError || mealsQ.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn't load your data.</p>
        <button
          onClick={() => {
            profileQ.refetch(); goalsQ.refetch(); mealsQ.refetch();
          }}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasLanguage && !isGuest) {
    return (
      <LanguageSelect
        onDone={async () => {
          localStorage.setItem("nouri:lang-picked", "1");
          setHasLanguage(true);
        }}
      />
    );
  }

  if (needsOnboarding || !userProfile || editingProfile) {
    return (
      <ProfileChatOnboarding
        initial={userProfile}
        onClose={editingProfile ? () => setEditingProfile(false) : undefined}
        onDone={async ({ profile: p, goals: g, warnings, plan }) => {
          setEditingProfile(false);
          const ext: ExtendedGoals = buildExtendedGoals(g, plan, parseWeightToKg(p.weight));
          try {
            await updateGoals.mutateAsync({ base: g, extended: ext });
            const heightCm = (() => {
              const h = p.height;
              const num = parseFloat(h?.replace(/[^0-9.]/g, "") ?? "");
              return isFinite(num) ? num : null;
            })();
            const age = typeof p.age === "number" ? p.age : parseInt(String(p.age), 10) || null;
            await updateProfile.mutateAsync({
              user_profile_json: p,
              user_warnings_json: warnings ?? [],
              age,
              weight_kg: parseWeightToKg(p.weight) ?? null,
              height_cm: heightCm,
              activity_level: p.activityLevel || null,
            } as any);
          } catch (e: any) {
            toast.error(e?.message || "Couldn't save goals");
          }
          try {
            const layout = await generateLayout({ profile: p, goals: g });
            saveLayout(layout);
          } catch (e) {
            console.error("layout generation failed", e);
          }
          toast.success("Profile saved");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isGuest && (
        <div className="bg-amber-100 text-amber-950 border-b border-amber-300 px-4 py-2 text-xs flex items-center justify-between gap-3">
          <span>
            <b>Temporary preview.</b> Nothing here is saved, and AI features need an account.
          </span>
          <button
            onClick={async () => { await signOut(); }}
            className="shrink-0 rounded-full bg-amber-950 text-amber-50 px-3 py-1 font-semibold"
          >
            Create account
          </button>
        </div>
      )}
      <NouriHeader
        signOutLabel={isGuest ? "Exit preview" : undefined}
        onSignOut={handleSignOut}
        rightSlot={
          <>
            <button
              onClick={() => { setSettingsPickLang(true); setShowSettings(true); }}
              className="text-base flex items-center justify-center px-2 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label={`Change language (current: ${langMeta.native})`}
              title={`Language: ${langMeta.native}`}
            >
              <span aria-hidden>{langMeta.flag}</span>
            </button>
            <button
              onClick={() => { setSettingsPickLang(false); setShowSettings(true); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={14} />
            </button>
            <NotificationBell
              goals={goals}
              meals={meals}
              profile={userProfile ?? null}
              onAddMeal={handleAddMeal}
              refreshKey={notifKey}
            />
          </>
        }
      />
      <main>
        {/* Suspense fallback handles the brief async chunk fetch on first
            visit to each tab. After that, the chunk is cached. */}
        <Suspense fallback={<ScreenLoader />}>
          <ScreenErrorBoundary resetKey={tab} title="This Nutri AI screen hit an error">
          {tab === "today" && (
            <TodayScreen
              goals={goals}
              meals={meals}
              userId={user?.id}
              userProfile={userProfile}
              onDeleteMeal={handleDeleteMeal}
              onGoLog={(prefillText) => {
                if (prefillText) setLogPrefill({ text: prefillText, source: "text", autoSend: false });
                setTab("log");
              }}
              onGoHistory={() => setTab("me")}
              onPickSuggestion={(name) => { setLogPrefill({ text: name, source: "text", autoSend: false }); setTab("log"); }}
              onOpenXP={() => setShowXP(true)}
              onStartCheckin={() => setShowCheckin(true)}
            />
          )}
          {tab === "log" && isGuest && <GuestLogScreen onAddMeal={handleAddMeal} />}
          {tab === "log" && !isGuest && (
            <NouriChatScreen
              goals={goals}
              meals={meals}
              prefillText={logPrefill?.text}
              prefillSource={logPrefill?.source}
              prefillAutoSend={logPrefill?.autoSend}
              onPrefillConsumed={() => setLogPrefill(undefined)}
              autoStartVoice={chatAutoVoice}
              onAutoVoiceConsumed={() => setChatAutoVoice(false)}
              onAddMeal={handleAddMeal}
              onDeleteMeal={handleDeleteMeal}
            />
          )}
          {tab === "plan" && <PlanScreen goals={goals} userProfile={userProfile} />}
          {tab === "me" && (
            <MeScreen
              meals={meals}
              goals={goals}
              userId={user?.id}
              onDelete={handleDeleteMeal}
              onOpenXP={() => setShowXP(true)}
              onStartCheckin={() => setShowCheckin(true)}
              onOpenSettings={() => { setSettingsPickLang(false); setShowSettings(true); }}
              onOpenFeedback={() =>
                setFeedbackDecision((current) =>
                  current ?? {
                    shouldPrompt: true,
                    reason: "third_open",
                    state: {
                      app_open_count: 0,
                      last_prompted_at: null,
                      submitted_at: null,
                      next_due_at: null,
                    },
                  },
                )
              }
            />
          )}
          </ScreenErrorBoundary>
        </Suspense>
      </main>
      {tab === "today" && !isGuest && (
        <LogOptionsFAB
          meals={meals}
          onAddMeal={handleAddMeal}
          onGoChat={(opts) => {
            if (opts?.prefill) setLogPrefill(opts.prefill);
            if (opts?.startVoice) setChatAutoVoice(true);
            setTab("log");
          }}
        />
      )}
      <TabBar active={tab} onChange={setTab} />
      <XPFloater />
      <GoalCelebration />
      {showXP && <XPScreen onClose={() => setShowXP(false)} />}
      {showSettings && (
        <SettingsScreen
          initialPicking={settingsPickLang}
          userProfile={userProfile}
          userId={isGuest ? undefined : user?.id}
          onOpenFeedback={() => {
            setShowSettings(false);
            setSettingsPickLang(false);
            setFeedbackDecision((current) =>
              current ?? {
                shouldPrompt: true,
                reason: "third_open",
                state: {
                  app_open_count: 0,
                  last_prompted_at: null,
                  submitted_at: null,
                  next_due_at: null,
                },
              },
            );
          }}
          onClose={() => { setShowSettings(false); setSettingsPickLang(false); }}
        />
      )}
      {showWeeklyReport && !needsOnboarding && (
        <WeeklyReport
          name={userProfile?.name?.split(" ")[0] || "friend"}
          userId={user?.id}
          meals={meals}
          goals={goals}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}
      {showCheckin && (
        <WeeklyCheckin
          goals={goals}
          meals={meals}
          profile={userProfile}
          onClose={() => setShowCheckin(false)}
          onGoalsUpdated={async (g, full) => {
            const prev = goalsQ.data?.extended;
            const ext: ExtendedGoals = {
              ...(prev ?? { calories: g.calories, protein: g.protein, carbs: g.carbs, fat: g.fat }),
              calories: g.calories,
              protein: g.protein,
              carbs: g.carbs,
              fat: g.fat,
              fiber: full?.fiber ?? prev?.fiber,
              sugar_max: full?.sugar_max ?? prev?.sugar_max,
              saturated_fat_max: full?.saturated_fat_max ?? prev?.saturated_fat_max,
              sodium_max: full?.sodium_max ?? prev?.sodium_max,
              cholesterol_max: full?.cholesterol_max ?? prev?.cholesterol_max,
              potassium: full?.potassium ?? prev?.potassium,
              calcium: full?.calcium ?? prev?.calcium,
              iron: full?.iron ?? prev?.iron,
              vitamin_c: full?.vitamin_c ?? prev?.vitamin_c,
              vitamin_d: full?.vitamin_d ?? prev?.vitamin_d,
              vitamin_a: full?.vitamin_a ?? prev?.vitamin_a,
              calibrated_at: new Date().toISOString(),
            };
            try {
              await updateGoals.mutateAsync({ base: g, extended: ext });
              if (full?.summary) toast.success(full.summary);
            } catch (e: any) {
              toast.error(e?.message || "Couldn't save updated goals");
            }
            try {
              const layout = await generateLayout({
                profile: userProfile,
                goals: g,
                currentLayout: getStoredLayout(user?.id),
              });
              saveLayout(layout, user?.id);
            } catch (e) {
              console.error("layout regeneration failed", e);
            }
          }}
        />
      )}
      {feedbackDecision && !showXP && !showSettings && !showWeeklyReport && !showCheckin && (
        <FeedbackPrompt
          decision={feedbackDecision}
          onClose={() => setFeedbackDecision(null)}
          onSubmitted={() => setFeedbackDecision(null)}
        />
      )}
    </div>
  );
};

export default Index;
