import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/components/nouri/ProfileChatOnboarding";
import { DEFAULT_GOALS, type Goals } from "@/lib/nouri-storage";
import { setLanguage, getLanguage, LANGUAGES, type LangCode } from "@/lib/nouri-i18n";

/**
 * Guest ("Try for Free") mode: a temporary, local-only preview.
 *  - no Supabase session, nothing is sent to or saved in the cloud
 *  - lives in this browser tab (sessionStorage flag), gone when the tab closes
 *  - anything already stored on this device is backed up first and restored after
 */
export const GUEST_USER_ID = "guest-local";
const GUEST_FLAG = "nouri.guest"; // sessionStorage: guest session active in this tab
const BACKUP_KEY = "nouri.guest.backup"; // localStorage: the device's real data while a guest session runs

export const GUEST_USER = {
  id: GUEST_USER_ID,
  aud: "guest",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
  is_anonymous: true,
} as unknown as User;

export const isGuestUser = (user: User | null | undefined): boolean =>
  !!user && (user.id === GUEST_USER_ID || user.is_anonymous === true);

export function isGuestSessionActive(): boolean {
  try {
    return sessionStorage.getItem(GUEST_FLAG) === "1";
  } catch {
    return false;
  }
}

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

function detectLanguage(): LangCode {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const base = nav.toLowerCase().split("-")[0];
  return (LANGUAGES.find((l) => l.code === base)?.code ?? "en") as LangCode;
}

function snapshotLocalStorage(): string {
  const all: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k !== BACKUP_KEY) all[k] = localStorage.getItem(k) ?? "";
  }
  return JSON.stringify(all);
}

/** Put the device's real data back and drop everything the guest created. */
export function restoreDeviceData() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (raw === null) return;
    const saved = JSON.parse(raw) as Record<string, string>;
    localStorage.clear();
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
  } catch {
    /* storage unavailable or backup unreadable: leave things as they are */
  }
}

/** Start a temporary guest session. Returns false if the browser blocks storage. */
export function startGuestSession(): boolean {
  try {
    if (localStorage.getItem(BACKUP_KEY) === null) {
      localStorage.setItem(BACKUP_KEY, snapshotLocalStorage());
    }
    // Fresh slate: the guest must not see (or overwrite) anything from this device
    Object.keys(localStorage)
      .filter((k) => k !== BACKUP_KEY)
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.setItem(GUEST_FLAG, "1");
    // No language picker for guests
    if (!getLanguage()) setLanguage(detectLanguage());
    localStorage.setItem("nouri:lang-picked", "1");
    return true;
  } catch {
    return false;
  }
}

/** End the guest session and restore the device's real data. */
export function endGuestSession() {
  try {
    sessionStorage.removeItem(GUEST_FLAG);
  } catch {
    /* ignore */
  }
  restoreDeviceData();
}

/**
 * Run once when the app loads. If a guest session was left behind (tab closed
 * without exiting), restore the device's real data now.
 */
export function cleanUpAbandonedGuestSession() {
  if (!isGuestSessionActive()) restoreDeviceData();
}
