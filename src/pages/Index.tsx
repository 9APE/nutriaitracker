import { useEffect, useState } from "react";
import { storage, type Goals, type Meal } from "@/lib/nouri-storage";
import { Onboarding } from "@/components/nouri/Onboarding";
import { TabBar, type TabKey } from "@/components/nouri/TabBar";
import { NouriHeader } from "@/components/nouri/NouriHeader";
import { TodayScreen } from "@/components/nouri/TodayScreen";
import { LogScreen } from "@/components/nouri/LogScreen";
import { HistoryScreen } from "@/components/nouri/HistoryScreen";
import { InsightsScreen } from "@/components/nouri/InsightsScreen";
import { toast } from "sonner";

const Index = () => {
  const [onboarded, setOnboarded] = useState<boolean>(() => storage.isOnboarded());
  const [goals, setGoals] = useState<Goals>(() => storage.getGoals());
  const [meals, setMeals] = useState<Meal[]>(() => storage.getMeals());
  const [tab, setTab] = useState<TabKey>("today");

  useEffect(() => {
    storage.setMeals(meals);
  }, [meals]);

  useEffect(() => {
    storage.setGoals(goals);
  }, [goals]);

  const handleOnboardDone = () => {
    setGoals(storage.getGoals());
    setOnboarded(true);
  };

  const handleAddMeal = (m: Meal) => {
    setMeals((prev) => [m, ...prev]);
    setTab("today");
  };

  const handleDeleteMeal = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    toast("Meal removed");
  };

  const handleSignOut = () => {
    if (!confirm("Sign out and reset all your Nouri data?")) return;
    storage.reset();
    setMeals([]);
    setGoals(storage.getGoals());
    setOnboarded(false);
    toast("Signed out");
  };

  if (!onboarded) {
    return <Onboarding onDone={handleOnboardDone} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <NouriHeader onSignOut={handleSignOut} />
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
