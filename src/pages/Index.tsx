import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { storage, type Goals, type Meal, DEFAULT_GOALS, todayISO } from "@/lib/nouri-storage";
import { Onboarding, type BodyStats } from "@/components/nouri/Onboarding";
import { TabBar, type TabKey } from "@/components/nouri/TabBar";
import { NouriHeader } from "@/components/nouri/NouriHeader";
import { TodayScreen } from "@/components/nouri/TodayScreen";
import { LogScreen } from "@/components/nouri/LogScreen";
import { HistoryScreen } from "@/components/nouri/HistoryScreen";
import { InsightsScreen } from "@/components/nouri/InsightsScreen";
import { NotificationBell } from "@/components/nouri/NotificationBell";
import { useAutoSuggestions } from "@/hooks/useAutoSuggestions";
import { notifStore } from "@/lib/nouri-suggestions";
import { useAuth } from "@/lib/auth-context";
import { cloud, type Profile } from "@/lib/nouri-cloud";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import {
  ProfileChatOnboarding,
  type UserProfile,
} from "@/components/nouri/ProfileChatOnboarding";
import { reconcileStreakOnAppOpen, consumePendingMessage } from "@/lib/nouri-streak";
import { awardMealXP, checkDailyGoalAwards } from "@/lib/nouri-xp";
import { XPFloater } from "@/components/nouri/XPFloater";
import { XPScreen } from "@/components/nouri/XPScreen";
import { WeeklyCheckin } from "@/components/nouri/WeeklyCheckin";
import { WeeklyReport } from "@/components/nouri/WeeklyReport";
import { shouldShowWeeklyReport } from "@/lib/nouri-weekly-report";
import { GoalCelebration } from "@/components/nouri/GoalCelebration";
import { LanguageSelect } from "@/components/nouri/LanguageSelect";
import { SettingsScreen } from "@/components/nouri/SettingsScreen";
import { getLanguage, getLanguageMeta, useLanguage } from "@/lib/nouri-i18n";
import { Settings as SettingsIcon } from "lucide-react";

const MIGRATED_KEY = "nouri:migrated";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tab, setTab] = useState<TabKey>("today");
  const [notifKey, setNotifKey] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [logPrefill, setLogPrefill] = useState<string | undefined>(undefined);
  const [showXP, setShowXP] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPickLang, setSettingsPickLang] = useState(false);
  const [hasLanguage, setHasLanguage] = useState<boolean>(() => !!getLanguage());
  const currentLang = useLanguage();
  const langMeta = getLanguageMeta(currentLang);

  // Reconcile streak (spend a freeze if a day was missed) on app open
  useEffect(() => {
    reconcileStreakOnAppOpen();
    const pending = consumePendingMessage();
    if (pending?.kind === "freeze-used") {
      toast("🛡️ Streak freeze used! Your 🔥 streak is safe. Log today to keep it going.", {
        duration: 6000,
      });
    } else if (pending?.kind === "streak-ended") {
      toast("Your streak ended — but you can start again today! 🔥", { duration: 6000 });
    }
    // Record signup date once for weekly check-in cadence
    if (!localStorage.getItem("nouri:signupDate")) {
      localStorage.setItem("nouri:signupDate", todayISO());
    }
  }, []);

  // Load user data on auth
  useEffect(() => {
    if (!user) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    setBootstrapping(true);

    (async () => {
      try {
        // One-time migration from localStorage (only for *this* browser)
        const alreadyMigrated = localStorage.getItem(`${MIGRATED_KEY}:${user.id}`) === "true";
        if (!alreadyMigrated) {
          const localMeals = storage.getMeals();
          if (localMeals.length > 0) {
            try {
              await cloud.bulkInsertMeals(
                user.id,
                localMeals.map((m) => ({
                  meal_name: m.meal_name,
                  type: m.type,
                  calories: m.calories,
                  protein: m.protein,
                  carbs: m.carbs,
                  fat: m.fat,
                  date: m.date,
                }))
              );
              toast(`Imported ${localMeals.length} meals from this device`);
            } catch (e) {
              console.error("migration failed", e);
            }
          }
          // Migrate goals if user has customised them locally
          const localGoals = storage.getGoals();
          const isDefaultGoals =
            localGoals.calories === DEFAULT_GOALS.calories &&
            localGoals.protein === DEFAULT_GOALS.protein &&
            localGoals.carbs === DEFAULT_GOALS.carbs &&
            localGoals.fat === DEFAULT_GOALS.fat;
          if (!isDefaultGoals) {
            try {
              await cloud.upsertGoals(user.id, localGoals);
            } catch (e) {
              console.error("goal migration failed", e);
            }
          }
          localStorage.setItem(`${MIGRATED_KEY}:${user.id}`, "true");
          // Clear local data so it's no longer the source of truth
          storage.reset();
        }

        const [prof, g, ms] = await Promise.all([
          cloud.getProfile(user.id),
          cloud.getGoals(user.id),
          cloud.listMeals(user.id),
        ]);
        if (cancelled) return;

        setProfile(prof);
        setGoals(g ?? DEFAULT_GOALS);
        setMeals(ms);

        // Hydrate the chat-onboarding profile from the cloud (per-user)
        if (prof?.user_profile_json) {
          setUserProfile(prof.user_profile_json as UserProfile);
        } else {
          setUserProfile(null);
        }
        if (prof?.user_warnings_json && Array.isArray(prof.user_warnings_json)) {
          try {
            localStorage.setItem("userWarnings", JSON.stringify(prof.user_warnings_json));
          } catch {}
        }

        // Trigger onboarding if profile has no body stats yet
        const hasStats = !!(prof?.age || prof?.weight_kg || prof?.height_cm || prof?.activity_level);
        setNeedsOnboarding(!hasStats);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load your data");
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
          if (shouldShowWeeklyReport()) setShowWeeklyReport(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useAutoSuggestions({
    goals,
    meals,
    onNew: () => setNotifKey((k) => k + 1),
  });

  const handleOnboardDone = async ({
    goals: g,
    stats,
  }: {
    goals: Goals;
    stats: BodyStats;
  }) => {
    if (!user) return;
    try {
      await cloud.upsertGoals(user.id, g);
      await cloud.updateProfile(user.id, {
        age: stats.age ?? null,
        weight_kg: stats.weight_kg ?? null,
        height_cm: stats.height_cm ?? null,
        activity_level: stats.activity_level ?? null,
      });
      setGoals(g);
      setProfile((p) => (p ? { ...p, ...stats } as Profile : p));
      setNeedsOnboarding(false);
      toast.success("All set 🌿");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save your profile");
    }
  };

  const handleAddMeal = async (m: Meal) => {
    if (!user) return;
    // Optimistic add
    setMeals((prev) => [m, ...prev]);
    setTab("today");

    // Award XP: meal log, then check daily goal milestones
    awardMealXP();
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
    checkDailyGoalAwards(totalsToday, goals);

    try {
      const saved = await cloud.addMeal(user.id, {
        meal_name: m.meal_name,
        type: m.type,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        date: m.date,
      });
      // Replace optimistic entry with server row (so id matches)
      setMeals((prev) => [saved, ...prev.filter((x) => x.id !== m.id)]);
    } catch (e: any) {
      setMeals((prev) => prev.filter((x) => x.id !== m.id));
      toast.error(e?.message || "Couldn't save meal");
    }
  };

  const handleDeleteMeal = async (id: string) => {
    if (!user) return;
    const previous = meals;
    setMeals((prev) => prev.filter((m) => m.id !== id));
    try {
      await cloud.deleteMeal(user.id, id);
      toast("Meal removed");
    } catch (e: any) {
      setMeals(previous);
      toast.error(e?.message || "Couldn't delete meal");
    }
  };

  const handleSignOut = async () => {
    if (!confirm("Sign out of Nouri?")) return;
    notifStore.clear();
    await signOut();
    toast("Signed out");
  };

  if (authLoading || (user && bootstrapping)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Language selection — must come BEFORE any AI chat / onboarding
  if (!hasLanguage) {
    return <LanguageSelect onDone={() => setHasLanguage(true)} />;
  }

  if (needsOnboarding) {
    return (
      <Onboarding
        initialGoals={goals}
        initialStats={{
          age: profile?.age ?? undefined,
          weight_kg: profile?.weight_kg ?? undefined,
          height_cm: profile?.height_cm ?? undefined,
          activity_level: profile?.activity_level ?? undefined,
        }}
        onDone={handleOnboardDone}
      />
    );
  }

  // First-launch chat onboarding (or editing profile)
  if (!userProfile || editingProfile) {
    return (
      <ProfileChatOnboarding
        initial={userProfile}
        onClose={editingProfile ? () => setEditingProfile(false) : undefined}
        onDone={async ({ profile: p, goals: g, warnings }) => {
          setUserProfile(p);
          setEditingProfile(false);
          if (user) {
            try {
              await cloud.upsertGoals(user.id, g);
              await cloud.updateProfile(user.id, {
                user_profile_json: p,
                user_warnings_json: warnings ?? [],
              } as any);
              setGoals(g);
              setProfile((prev) =>
                prev
                  ? ({ ...prev, user_profile_json: p, user_warnings_json: warnings ?? [] } as Profile)
                  : prev
              );
            } catch (e: any) {
              toast.error(e?.message || "Couldn't save goals");
            }
          }
          toast.success("Profile saved 🌿");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NouriHeader
        onSignOut={handleSignOut}
        rightSlot={
          <>
            <button
              onClick={() => {
                setSettingsPickLang(true);
                setShowSettings(true);
              }}
              className="text-base flex items-center justify-center px-2 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label={`Change language (current: ${langMeta.native})`}
              title={`Language: ${langMeta.native}`}
            >
              <span aria-hidden>{langMeta.flag}</span>
            </button>
            <button
              onClick={() => setEditingProfile(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <UserCog size={13} />
              Profile
            </button>
            <button
              onClick={() => {
                setSettingsPickLang(false);
                setShowSettings(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={14} />
            </button>
            <NotificationBell
              goals={goals}
              meals={meals}
              onAddMeal={handleAddMeal}
              refreshKey={notifKey}
            />
          </>
        }
      />
      <main>
        {tab === "today" && (
          <TodayScreen
            goals={goals}
            meals={meals}
            onDeleteMeal={handleDeleteMeal}
            onGoLog={() => setTab("log")}
            onPickSuggestion={(name) => {
              setLogPrefill(name);
              setTab("log");
            }}
            onOpenXP={() => setShowXP(true)}
            onStartCheckin={() => setShowCheckin(true)}
          />
        )}
        {tab === "log" && (
          <LogScreen
            onLogged={handleAddMeal}
            prefillText={logPrefill}
            onPrefillConsumed={() => setLogPrefill(undefined)}
          />
        )}
        {tab === "history" && <HistoryScreen meals={meals} onDelete={handleDeleteMeal} />}
        {tab === "insights" && <InsightsScreen meals={meals} goals={goals} />}
      </main>
      <TabBar active={tab} onChange={setTab} />
      <XPFloater />
      <GoalCelebration />
      {showXP && <XPScreen onClose={() => setShowXP(false)} />}
      {showSettings && (
        <SettingsScreen
          initialPicking={settingsPickLang}
          onClose={() => {
            setShowSettings(false);
            setSettingsPickLang(false);
          }}
        />
      )}
      {showWeeklyReport && !needsOnboarding && (
        <WeeklyReport
          name={userProfile?.name?.split(" ")[0] || "friend"}
          meals={meals}
          goals={goals}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}
      {showCheckin && (
        <WeeklyCheckin
          goals={goals}
          meals={meals}
          onClose={() => setShowCheckin(false)}
          onGoalsUpdated={async (g) => {
            setGoals(g);
            if (user) {
              try {
                await cloud.upsertGoals(user.id, g);
              } catch (e: any) {
                toast.error(e?.message || "Couldn't save updated goals");
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default Index;
