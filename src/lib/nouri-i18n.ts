// Lightweight in-app i18n + language preference helpers.
// Stores selected language in localStorage as 'appLanguage'.

export type LangCode =
  | "en"
  | "fr"
  | "es"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "ar"
  | "zh"
  | "ja";

export interface LanguageMeta {
  code: LangCode;
  name: string; // English name (for system prompt clarity)
  native: string; // Shown in selector
  flag: string;
  rtl?: boolean;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "de", name: "German", native: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italian", native: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", native: "Nederlands", flag: "🇳🇱" },
  { code: "ar", name: "Arabic", native: "عربي", flag: "🇸🇦", rtl: true },
  { code: "zh", name: "Chinese", native: "中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵" },
];

const STORAGE_KEY = "appLanguage";

export function getLanguage(): LangCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    return LANGUAGES.some((l) => l.code === v) ? (v as LangCode) : null;
  } catch {
    return null;
  }
}

export function setLanguage(code: LangCode) {
  localStorage.setItem(STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent("language:changed", { detail: code }));
}

export function getLanguageMeta(code?: LangCode | null): LanguageMeta {
  const c = code ?? getLanguage() ?? "en";
  return LANGUAGES.find((l) => l.code === c) ?? LANGUAGES[0];
}

// ── Static UI strings ──────────────────────────────────────────────────────
type Dict = Record<string, string>;

const STRINGS: Record<LangCode, Dict> = {
  en: {
    today: "Today",
    log: "Log",
    history: "History",
    insights: "Insights",
    chooseLanguage: "Choose your language",
    languageContinue: "Continue",
    settings: "Settings",
    language: "Language",
    profile: "Profile",
    signOut: "Sign out",
    typeAnswer: "Type your answer…",
    listening: "Listening…",
  },
  fr: {
    today: "Aujourd'hui",
    log: "Ajouter",
    history: "Historique",
    insights: "Aperçus",
    chooseLanguage: "Choisissez votre langue",
    languageContinue: "Continuer",
    settings: "Paramètres",
    language: "Langue",
    profile: "Profil",
    signOut: "Déconnexion",
    typeAnswer: "Tapez votre réponse…",
    listening: "Écoute…",
  },
  es: {
    today: "Hoy",
    log: "Registrar",
    history: "Historial",
    insights: "Análisis",
    chooseLanguage: "Elige tu idioma",
    languageContinue: "Continuar",
    settings: "Ajustes",
    language: "Idioma",
    profile: "Perfil",
    signOut: "Cerrar sesión",
    typeAnswer: "Escribe tu respuesta…",
    listening: "Escuchando…",
  },
  de: {
    today: "Heute",
    log: "Eintragen",
    history: "Verlauf",
    insights: "Einblicke",
    chooseLanguage: "Wähle deine Sprache",
    languageContinue: "Weiter",
    settings: "Einstellungen",
    language: "Sprache",
    profile: "Profil",
    signOut: "Abmelden",
    typeAnswer: "Antwort eingeben…",
    listening: "Höre zu…",
  },
  it: {
    today: "Oggi",
    log: "Registra",
    history: "Cronologia",
    insights: "Analisi",
    chooseLanguage: "Scegli la tua lingua",
    languageContinue: "Continua",
    settings: "Impostazioni",
    language: "Lingua",
    profile: "Profilo",
    signOut: "Esci",
    typeAnswer: "Scrivi la tua risposta…",
    listening: "In ascolto…",
  },
  pt: {
    today: "Hoje",
    log: "Registar",
    history: "Histórico",
    insights: "Análises",
    chooseLanguage: "Escolha o seu idioma",
    languageContinue: "Continuar",
    settings: "Definições",
    language: "Idioma",
    profile: "Perfil",
    signOut: "Sair",
    typeAnswer: "Escreva a sua resposta…",
    listening: "A ouvir…",
  },
  nl: {
    today: "Vandaag",
    log: "Loggen",
    history: "Geschiedenis",
    insights: "Inzichten",
    chooseLanguage: "Kies je taal",
    languageContinue: "Doorgaan",
    settings: "Instellingen",
    language: "Taal",
    profile: "Profiel",
    signOut: "Uitloggen",
    typeAnswer: "Typ je antwoord…",
    listening: "Aan het luisteren…",
  },
  ar: {
    today: "اليوم",
    log: "تسجيل",
    history: "السجل",
    insights: "تحليلات",
    chooseLanguage: "اختر لغتك",
    languageContinue: "متابعة",
    settings: "الإعدادات",
    language: "اللغة",
    profile: "الملف",
    signOut: "تسجيل الخروج",
    typeAnswer: "اكتب إجابتك…",
    listening: "جارٍ الاستماع…",
  },
  zh: {
    today: "今天",
    log: "记录",
    history: "历史",
    insights: "分析",
    chooseLanguage: "选择你的语言",
    languageContinue: "继续",
    settings: "设置",
    language: "语言",
    profile: "个人资料",
    signOut: "退出登录",
    typeAnswer: "输入你的回答…",
    listening: "正在聆听…",
  },
  ja: {
    today: "今日",
    log: "記録",
    history: "履歴",
    insights: "分析",
    chooseLanguage: "言語を選択",
    languageContinue: "続ける",
    settings: "設定",
    language: "言語",
    profile: "プロフィール",
    signOut: "ログアウト",
    typeAnswer: "回答を入力…",
    listening: "聞いています…",
  },
};

export function t(key: keyof typeof STRINGS["en"], lang?: LangCode): string {
  const code = lang ?? getLanguage() ?? "en";
  return STRINGS[code]?.[key] ?? STRINGS.en[key] ?? key;
}

// React hook that re-renders on language change
import { useEffect, useState } from "react";
export function useLanguage(): LangCode {
  const [lang, setLang] = useState<LangCode>(() => getLanguage() ?? "en");
  useEffect(() => {
    const onChange = (e: Event) => {
      const code = (e as CustomEvent).detail as LangCode;
      setLang(code);
    };
    window.addEventListener("language:changed", onChange);
    return () => window.removeEventListener("language:changed", onChange);
  }, []);
  return lang;
}
