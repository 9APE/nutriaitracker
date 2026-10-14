import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, Flame, Beef, Scale, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMeals } from "@/hooks/queries/useMeals";
import { useGoals } from "@/hooks/queries/useGoals";
import { useProfile } from "@/hooks/queries/useProfile";
import { todayISO } from "@/lib/nouri-storage";

function lastNDays(count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function parseProfileWeight(profile: any): number | null {
  if (typeof profile?.weight_kg === "number") return profile.weight_kg;
  const raw = profile?.user_profile_json?.weight;
  if (typeof raw !== "string") return null;
  const numeric = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseProfileHeightCm(profile: any): number | null {
  if (typeof profile?.height_cm === "number") return profile.height_cm;
  const raw = profile?.user_profile_json?.height;
  if (typeof raw !== "string") return null;
  const numeric = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <Icon size={15} className="text-primary" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export const Analytics = () => {
  const { user, loading: authLoading } = useAuth();
  const mealsQ = useMeals();
  const goalsQ = useGoals();
  const profileQ = useProfile();

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (mealsQ.isLoading || goalsQ.isLoading || profileQ.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-6">
        <div className="max-w-md mx-auto text-sm text-muted-foreground">Loading analytics…</div>
      </div>
    );
  }

  const meals = mealsQ.data ?? [];
  const goals = goalsQ.data?.base;
  const profile = profileQ.data;
  const today = todayISO();
  const todayMeals = meals.filter((meal) => meal.date === today);
  const recentDays = lastNDays(7);
  const dailyRollup = recentDays.map((day) => {
    const dayMeals = meals.filter((meal) => meal.date === day);
    return {
      day,
      calories: dayMeals.reduce((sum, meal) => sum + meal.calories, 0),
      protein: dayMeals.reduce((sum, meal) => sum + meal.protein, 0),
      meals: dayMeals.length,
    };
  });

  const weekCalories = dailyRollup.reduce((sum, day) => sum + day.calories, 0);
  const weekProtein = dailyRollup.reduce((sum, day) => sum + day.protein, 0);
  const avgCalories = Math.round(weekCalories / Math.max(dailyRollup.length, 1));
  const avgProtein = Math.round(weekProtein / Math.max(dailyRollup.length, 1));
  const goalDaysHit = dailyRollup.filter((day) => (goals?.protein ?? 0) > 0 && day.protein >= (goals?.protein ?? 0)).length;

  const weightKg = parseProfileWeight(profile);
  const heightCm = parseProfileHeightCm(profile);
  const bmi = weightKg && heightCm ? weightKg / Math.pow(heightCm / 100, 2) : null;
  const bmiLabel = !bmi
    ? "No body data yet"
    : bmi < 18.5
      ? "Underweight"
      : bmi < 25
        ? "Healthy range"
        : bmi < 30
          ? "Overweight"
          : "Obese";

  const maxCalories = Math.max(...dailyRollup.map((day) => day.calories), goals?.calories ?? 1, 1);

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-12">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Back to Nutri AI"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-medium text-foreground">Nutri AI analytics</h1>
            <p className="text-xs text-muted-foreground">Live data from your meals, goals, and profile.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Today"
            value={`${todayMeals.reduce((sum, meal) => sum + meal.calories, 0)} kcal`}
            detail={`${todayMeals.length} meals logged`}
            icon={Flame}
          />
          <StatCard
            title="Protein avg"
            value={`${avgProtein}g`}
            detail={`Hit goal on ${goalDaysHit}/7 days`}
            icon={Beef}
          />
          <StatCard
            title="Current weight"
            value={weightKg ? `${Math.round(weightKg)} kg` : "Not set"}
            detail={bmi ? `BMI ${bmi.toFixed(1)} · ${bmiLabel}` : "Add height and weight in your profile"}
            icon={Scale}
          />
          <StatCard
            title="Calories avg"
            value={`${avgCalories}`}
            detail={goals?.calories ? `Goal ${goals.calories} kcal/day` : "No calorie goal set"}
            icon={Activity}
          />
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Last 7 days</h2>
            <div className="text-xs text-muted-foreground">{weekCalories} kcal total</div>
          </div>
          <div className="mt-4 space-y-3">
            {dailyRollup.map((day) => {
              const width = `${Math.max(8, Math.round((day.calories / maxCalories) * 100))}%`;
              const label = new Date(day.day).toLocaleDateString(undefined, { weekday: "short" });
              return (
                <div key={day.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground">{day.calories} kcal · {day.protein}g protein</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};


