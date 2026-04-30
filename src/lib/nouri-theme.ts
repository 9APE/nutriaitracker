// Theme system: System (default) / Light / Dark.
// Stores preference in localStorage as 'themePreference'.
// Applies by toggling `.dark` class on <html>.

import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "themePreference";

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // Update theme-color meta for native browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#121212" : "#3A7D5C");
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {}
  applyTheme(resolveTheme(pref));
  window.dispatchEvent(new CustomEvent("theme:changed", { detail: pref }));
}

/** Call once on app startup (in main.tsx) before React renders. */
export function initTheme() {
  const pref = getThemePreference();
  applyTheme(resolveTheme(pref));

  // React to system changes when in 'system' mode.
  if (typeof window !== "undefined" && window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemePreference() === "system") {
        applyTheme(getSystemTheme());
        window.dispatchEvent(new CustomEvent("theme:changed", { detail: "system" }));
      }
    };
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
  }
}

/** Hook: re-renders when theme preference changes. */
export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());
  useEffect(() => {
    const handler = () => setPref(getThemePreference());
    window.addEventListener("theme:changed", handler);
    return () => window.removeEventListener("theme:changed", handler);
  }, []);
  return pref;
}
