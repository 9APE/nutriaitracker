// Shared language helper for Nouri edge functions.
// Receives a language code from the client and returns:
//  - a system-prompt suffix that locks Claude into one language (appended to END)
//  - the human-readable name + BCP-47 locale tag

export interface LangInfo {
  code: string;
  name: string;
  locale: string;
  /** Append to the END of the system prompt. */
  suffix: string;
}

const META: Record<string, { name: string; locale: string }> = {
  en: { name: "English",    locale: "en-US" },
  fr: { name: "French",     locale: "fr-FR" },
  de: { name: "German",     locale: "de-DE" },
  es: { name: "Spanish",    locale: "es-ES" },
  it: { name: "Italian",    locale: "it-IT" },
  pt: { name: "Portuguese", locale: "pt-PT" },
  nl: { name: "Dutch",      locale: "nl-NL" },
  ar: { name: "Arabic",     locale: "ar-SA" },
  zh: { name: "Chinese",    locale: "zh-CN" },
  ja: { name: "Japanese",   locale: "ja-JP" },
};

export function resolveLanguage(input: unknown, nameInput?: unknown): LangInfo {
  const code = typeof input === "string" && META[input] ? input : "en";
  const name =
    (typeof nameInput === "string" && nameInput.trim()) || META[code].name;
  const locale = META[code].locale;
  const suffix = `\n\nAlways reply in ${name}. Every word of your response must be in ${name} only. Never switch to another language under any circumstances.`;
  return { code, name, locale, suffix };
}
