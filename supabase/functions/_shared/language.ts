// Shared language helper for Nouri edge functions.
// Receives a language code from the client and returns:
//  - a system-prompt prefix that locks Claude into one language
//  - the human-readable name for logs / UI

export interface LangInfo {
  code: string;
  name: string;
  prefix: string;
}

const NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
};

export function resolveLanguage(input: unknown): LangInfo {
  const code = typeof input === "string" && NAMES[input] ? input : "en";
  const name = NAMES[code];
  const prefix = `Always respond in ${name}. Every message, tip, recommendation and question must be in ${name} only. Never switch languages.\n\n`;
  return { code, name, prefix };
}
