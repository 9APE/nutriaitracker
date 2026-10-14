export type MeSectionMode = "signals" | "insights";

const STORAGE_KEY = "nouri:me-section-mode";
const EVENT_NAME = "nouri:me-section-mode-updated";

function keyForUser(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

export function getMeSectionMode(userId?: string | null): MeSectionMode {
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    return raw === "insights" ? "insights" : "signals";
  } catch {
    return "signals";
  }
}

export function setMeSectionMode(mode: MeSectionMode, userId?: string | null) {
  try {
    window.localStorage.setItem(keyForUser(userId), mode);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          mode,
          userId: userId ?? null,
        },
      }),
    );
  } catch {}
}

export function subscribeMeSectionMode(
  callback: (mode: MeSectionMode, userId?: string | null) => void,
) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ mode?: MeSectionMode; userId?: string | null }>).detail;
    const mode = detail?.mode === "insights" ? "insights" : "signals";
    callback(mode, detail?.userId ?? null);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
