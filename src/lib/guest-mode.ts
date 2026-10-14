import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/components/nouri/ProfileChatOnboarding";
import { DEFAULT_GOALS, type Goals } from "@/lib/nouri-storage";
import { setLanguage, LANGUAGES, type LangCode } from "@/lib/nouri-i18n";

/** Guests (Supabase anonymous users) skip language and profile onboarding entirely. */
export const isGuestUser = (user: User | null | undefined): boolean => !!user?.is_anonymous;

/** Neutral starting profile with no health conditions, restrictions or preferences. */
export const GUEST_PROFILE: UserProfile = {
  name: "Guest",
  age: 30,
  height: "170 cm",
  weight: "70 kg",
  sex: "",
  goals: "Eat healthier",
  conditions: [],
  restrictions: [],
  activityLevel: "Moderately active",
  dislikes: [],
  allergies: [],
};

export const GUEST_GOALS: Goals = { ...DEFAULT_GOALS };

/** Pick the browser language if we support it, otherwise English. */
function detectLanguage(): LangCode {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const base = nav.toLowerCase().split("-")[0];
  return (LANGUAGES.find((l) => l.code === base)?.code ?? "en") as LangCode;
}

/** Run before the guest session starts so the language picker never shows. */
export function prepareGuestDevice() {
  try {
    setLanguage(detectLanguage());
    localStorage.setItem("nouri:lang-picked", "1");
    localStorage.setItem("nouri.staySignedIn", "true");
    localStorage.setItem("userProfile", JSON.stringify(GUEST_PROFILE));
  } catch {
    /* storage unavailable: the app falls back to the normal flow */
  }
}
