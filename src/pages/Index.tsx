import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { storage, type Goals, type Meal, DEFAULT_GOALS } from "@/lib/nouri-storage";
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
  loadUserProfile,
  type UserProfile,
} from "@/components/nouri/ProfileChatOnboarding";

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => loadUserProfile());
  const [editingProfile, setEditingProfile] = useState(false);

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

        // Trigger onboarding if profile has no body stats yet
        const hasStats = !!(prof?.age || prof?.weight_kg || prof?.height_cm || prof?.activity_level);
        setNeedsOnboarding(!hasStats);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load your data");
      } finally {
        if (!cancelled) setBootstrapping(false);
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
        onDone={(p) => {
          setUserProfile(p);
          setEditingProfile(false);
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
              onClick={() => setEditingProfile(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <UserCog size={13} />
              Profile
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
          />
        )}
        {tab === "log" && <LogScreen onLogged={handleAddMeal} />}
        {tab === "history" && <HistoryScreen meals={meals} onDelete={handleDeleteMeal} />}
        {tab === "insights" && <InsightsScreen meals={meals} goals={goals} />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
};

export default Index;
