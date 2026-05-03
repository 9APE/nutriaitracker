import { useState, useEffect } from "react";
import { X, ChevronRight, Monitor, Sun, Moon, UserCog, Sparkles } from "lucide-react";
import { FamilySection } from "@/components/nouri/FamilySection";
import { toast } from "sonner";
import {
  LANGUAGES,
  getLanguageMeta,
  setLanguage,
  useLanguage,
  t,
  type LangCode,
} from "@/lib/nouri-i18n";
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "@/lib/nouri-theme";
import { EditProfileSheet } from "@/components/nouri/EditProfileSheet";
import type { UserProfile } from "@/components/nouri/ProfileChatOnboarding";
import type { Goals } from "@/lib/nouri-storage";
import { loadUserGoals, onGoalsChange, type ExtendedGoals } from "@/lib/nouri-goals";

interface Props {
  onClose: () => void;
  initialPicking?: boolean;
  /** When provided, exposes the focused-edit profile sheet. */
  userProfile?: UserProfile | null;
  userId?: string;
  onProfileSaved?: (next: UserProfile) => void;
  onGoalsRecalculated?: (goals: Goals, warnings: string[]) => void;
}

const CONFIRMATIONS: Record<LangCode, (name: string) => string> = {
  en: (n) => `Language updated! Nouri will now speak ${n} with you`,
  fr: (n) => `Langue mise à jour ! Nouri parlera maintenant ${n} avec toi`,
  de: (n) => `Sprache aktualisiert! Nouri spricht jetzt ${n} mit dir`,
  es: (n) => `¡Idioma actualizado! Nouri ahora hablará ${n} contigo`,
  it: (n) => `Lingua aggiornata! Nouri parlerà ora ${n} con te`,
  pt: (n) => `Idioma atualizado! A Nouri vai falar ${n} contigo agora`,
  nl: (n) => `Taal bijgewerkt! Nouri spreekt nu ${n} met je`,
  ar: (n) => `تم تحديث اللغة! ستتحدث Nouri معك بـ ${n} الآن`,
  zh: (n) => `语言已更新！Nouri 现在将用${n}与你交流`,
  ja: (n) => `言語が更新されました！Nouri はこれから${n}で話します`,
};

export function SettingsScreen({
  onClose,
  initialPicking = false,
  userProfile,
  userId,
  onProfileSaved,
  onGoalsRecalculated,
}: Props) {
  const lang = useLanguage();
  const current = getLanguageMeta(lang);
  const [picking, setPicking] = useState(initialPicking);
  const [editingProfile, setEditingProfile] = useState(false);
  const themePref = useThemePreference();
  const canEditProfile = !!(userProfile && userId && onProfileSaved && onGoalsRecalculated);

  const themeOptions: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
    { value: "system", label: t("themeSystem", lang), Icon: Monitor },
    { value: "light", label: t("themeLight", lang), Icon: Sun },
    { value: "dark", label: t("themeDark", lang), Icon: Moon },
  ];

  const [extGoals, setExtGoals] = useState<ExtendedGoals | null>(() => loadUserGoals());
  useEffect(() => {
    const refresh = () => setExtGoals(loadUserGoals());
    return onGoalsChange(refresh);
  }, []);
  const reasoning = extGoals?.reasoning;
  const reasoningEntries = reasoning
    ? (Object.entries(reasoning).filter(
        ([, v]) => typeof v === "string" && (v as string).trim(),
      ) as [string, string][])
    : [];
  const REASON_LABELS: Record<string, string> = {
    calories: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat",
    fiber: "Fiber", sodium_max: "Sodium limit", sugar_max: "Sugar limit",
    saturated_fat_max: "Saturated fat limit", cholesterol_max: "Cholesterol limit",
    potassium: "Potassium", calcium: "Calcium", iron: "Iron",
    vitamin_c: "Vitamin C", vitamin_d: "Vitamin D", vitamin_a: "Vitamin A",
  };

  const handlePick = (code: LangCode) => {
    setLanguage(code);
    setPicking(false);
    const meta = LANGUAGES.find((l) => l.code === code)!;
    const msg = (CONFIRMATIONS[code] ?? CONFIRMATIONS.en)(meta.native);
    toast.success(msg, { duration: 4500 });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto">
      <header className="sticky top-0 px-5 py-4 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl"></span>
            <span className="font-serif text-lg font-medium">{t("settings", lang)}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto space-y-3">
          {!picking && canEditProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="w-full flex items-center justify-between rounded-2xl border border-border bg-card hover:border-primary/40 px-4 py-3.5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <UserCog size={18} className="text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Edit profile</div>
                  <div className="text-xs text-muted-foreground">
                    Update conditions, diet, activity & preferences
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          )}

          {!picking && reasoningEntries.length > 0 && (
            <section className="rounded-2xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-primary" />
                <div className="text-sm font-medium">Why these goals?</div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                Personalised by AI based on your profile, conditions and activity.
              </p>
              <ul className="space-y-2">
                {reasoningEntries.map(([key, val]) => (
                  <li key={key} className="text-xs leading-relaxed">
                    <span className="font-medium text-foreground">
                      {REASON_LABELS[key] ?? key}:
                    </span>{" "}
                    <span className="text-muted-foreground">{val}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="w-full flex items-center justify-between rounded-2xl border border-border bg-card hover:border-primary/40 px-4 py-3.5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl"></span>
                <div>
                  <div className="text-sm font-medium">{t("language", lang)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{current.flag}</span>
                    <span>{current.native}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          ) : (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                {t("chooseLanguage", lang)}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => {
                  const isSel = current.code === l.code;
                  return (
                    <button
                      key={l.code}
                      onClick={() => handlePick(l.code)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSel
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                      dir={l.rtl ? "rtl" : "ltr"}
                    >
                      <span className="text-xl shrink-0">{l.flag}</span>
                      <span className="text-sm font-medium">{l.native}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPicking(false)}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground py-2"
              >
                ← Back
              </button>
            </section>
          )}

          {/* Theme toggle — always visible */}
          <section className="rounded-2xl border border-border bg-card px-4 py-3.5">
            <div className="text-sm font-medium mb-2.5">{t("theme", lang)}</div>
            <div role="radiogroup" aria-label={t("theme", lang)} className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, Icon }) => {
                const isSel = themePref === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => setThemePreference(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors ${
                      isSel
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Family profiles */}
          {!picking && <FamilySection />}
        </div>
      </div>

      {editingProfile && canEditProfile && userProfile && userId && (
        <EditProfileSheet
          profile={userProfile}
          userId={userId}
          onClose={() => setEditingProfile(false)}
          onProfileSaved={(p) => onProfileSaved!(p)}
          onGoalsRecalculated={(g, w) => onGoalsRecalculated!(g, w)}
        />
      )}
    </div>
  );
}
