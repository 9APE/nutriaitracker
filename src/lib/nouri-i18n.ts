// Lightweight in-app i18n + language preference helpers.
// Stores selected language in localStorage as 'appLanguage' (code) and
// 'appLanguageName' (English name used in Claude system prompts).

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
  locale: string; // BCP-47 tag for SpeechRecognition / transcription
  rtl?: boolean;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English",    native: "English",    flag: "🇬🇧", locale: "en-US" },
  { code: "fr", name: "French",     native: "Français",   flag: "🇫🇷", locale: "fr-FR" },
  { code: "de", name: "German",     native: "Deutsch",    flag: "🇩🇪", locale: "de-DE" },
  { code: "es", name: "Spanish",    native: "Español",    flag: "🇪🇸", locale: "es-ES" },
  { code: "it", name: "Italian",    native: "Italiano",   flag: "🇮🇹", locale: "it-IT" },
  { code: "pt", name: "Portuguese", native: "Português",  flag: "🇵🇹", locale: "pt-PT" },
  { code: "nl", name: "Dutch",      native: "Nederlands", flag: "🇳🇱", locale: "nl-NL" },
  { code: "ar", name: "Arabic",     native: "العربية",    flag: "🇸🇦", locale: "ar-SA", rtl: true },
  { code: "zh", name: "Chinese",    native: "中文",        flag: "🇨🇳", locale: "zh-CN" },
  { code: "ja", name: "Japanese",   native: "日本語",      flag: "🇯🇵", locale: "ja-JP" },
];

const CODE_KEY = "appLanguage";
const NAME_KEY = "appLanguageName";

export function getLanguage(): LangCode | null {
  try {
    const v = localStorage.getItem(CODE_KEY);
    if (!v) return null;
    return LANGUAGES.some((l) => l.code === v) ? (v as LangCode) : null;
  } catch {
    return null;
  }
}

export function getLanguageName(): string {
  try {
    const v = localStorage.getItem(NAME_KEY);
    if (v) return v;
  } catch {}
  const code = getLanguage() ?? "en";
  return LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}

export function getLocale(code?: LangCode | null): string {
  const c = code ?? getLanguage() ?? "en";
  return LANGUAGES.find((l) => l.code === c)?.locale ?? "en-US";
}

export function setLanguage(code: LangCode) {
  const meta = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
  localStorage.setItem(CODE_KEY, meta.code);
  localStorage.setItem(NAME_KEY, meta.name);
  window.dispatchEvent(new CustomEvent("language:changed", { detail: meta.code }));
}

export function getLanguageMeta(code?: LangCode | null): LanguageMeta {
  const c = code ?? getLanguage() ?? "en";
  return LANGUAGES.find((l) => l.code === c) ?? LANGUAGES[0];
}

// ── Static UI strings ──────────────────────────────────────────────────────
export const UI_KEYS = [
  // Tabs
  "today", "log", "history", "insights", "settings",
  // Headers / titles
  "chooseLanguage", "language", "profile", "signOut",
  // Buttons
  "languageContinue", "logIt", "tryAgain", "refresh", "getStarted",
  // Inputs / placeholders
  "typeAnswer", "listening", "describeMeal",
  // Section headers
  "yourGoals", "todaysMeals", "recommendations",
] as const;
export type UIKey = (typeof UI_KEYS)[number];

type Dict = Record<UIKey, string>;

const STRINGS: Record<LangCode, Dict> = {
  en: {
    today: "Today", log: "Log Meal", history: "History", insights: "Insights", settings: "Settings",
    chooseLanguage: "Choose your language", language: "Language", profile: "Profile", signOut: "Sign out",
    languageContinue: "Continue", logIt: "Log it", tryAgain: "Try again", refresh: "Refresh", getStarted: "Get Started",
    typeAnswer: "Type your answer…", listening: "Listening…", describeMeal: "Describe your meal…",
    yourGoals: "Your daily goals", todaysMeals: "Today's meals", recommendations: "Recommendations",
  },
  fr: {
    today: "Aujourd'hui", log: "Ajouter un repas", history: "Historique", insights: "Aperçus", settings: "Paramètres",
    chooseLanguage: "Choisissez votre langue", language: "Langue", profile: "Profil", signOut: "Déconnexion",
    languageContinue: "Continuer", logIt: "Enregistrer", tryAgain: "Réessayer", refresh: "Actualiser", getStarted: "Commencer",
    typeAnswer: "Tapez votre réponse…", listening: "Écoute…", describeMeal: "Décrivez votre repas…",
    yourGoals: "Vos objectifs quotidiens", todaysMeals: "Repas du jour", recommendations: "Recommandations",
  },
  de: {
    today: "Heute", log: "Mahlzeit eintragen", history: "Verlauf", insights: "Einblicke", settings: "Einstellungen",
    chooseLanguage: "Wähle deine Sprache", language: "Sprache", profile: "Profil", signOut: "Abmelden",
    languageContinue: "Weiter", logIt: "Speichern", tryAgain: "Nochmal", refresh: "Aktualisieren", getStarted: "Loslegen",
    typeAnswer: "Antwort eingeben…", listening: "Höre zu…", describeMeal: "Beschreibe deine Mahlzeit…",
    yourGoals: "Deine Tagesziele", todaysMeals: "Heutige Mahlzeiten", recommendations: "Empfehlungen",
  },
  es: {
    today: "Hoy", log: "Registrar comida", history: "Historial", insights: "Análisis", settings: "Ajustes",
    chooseLanguage: "Elige tu idioma", language: "Idioma", profile: "Perfil", signOut: "Cerrar sesión",
    languageContinue: "Continuar", logIt: "Guardar", tryAgain: "Reintentar", refresh: "Actualizar", getStarted: "Empezar",
    typeAnswer: "Escribe tu respuesta…", listening: "Escuchando…", describeMeal: "Describe tu comida…",
    yourGoals: "Tus objetivos diarios", todaysMeals: "Comidas de hoy", recommendations: "Recomendaciones",
  },
  it: {
    today: "Oggi", log: "Registra pasto", history: "Cronologia", insights: "Analisi", settings: "Impostazioni",
    chooseLanguage: "Scegli la tua lingua", language: "Lingua", profile: "Profilo", signOut: "Esci",
    languageContinue: "Continua", logIt: "Salva", tryAgain: "Riprova", refresh: "Aggiorna", getStarted: "Inizia",
    typeAnswer: "Scrivi la tua risposta…", listening: "In ascolto…", describeMeal: "Descrivi il tuo pasto…",
    yourGoals: "I tuoi obiettivi giornalieri", todaysMeals: "Pasti di oggi", recommendations: "Consigli",
  },
  pt: {
    today: "Hoje", log: "Registar refeição", history: "Histórico", insights: "Análises", settings: "Definições",
    chooseLanguage: "Escolha o seu idioma", language: "Idioma", profile: "Perfil", signOut: "Sair",
    languageContinue: "Continuar", logIt: "Guardar", tryAgain: "Tentar de novo", refresh: "Atualizar", getStarted: "Começar",
    typeAnswer: "Escreva a sua resposta…", listening: "A ouvir…", describeMeal: "Descreva a sua refeição…",
    yourGoals: "Os seus objetivos diários", todaysMeals: "Refeições de hoje", recommendations: "Recomendações",
  },
  nl: {
    today: "Vandaag", log: "Maaltijd loggen", history: "Geschiedenis", insights: "Inzichten", settings: "Instellingen",
    chooseLanguage: "Kies je taal", language: "Taal", profile: "Profiel", signOut: "Uitloggen",
    languageContinue: "Doorgaan", logIt: "Opslaan", tryAgain: "Opnieuw", refresh: "Vernieuwen", getStarted: "Beginnen",
    typeAnswer: "Typ je antwoord…", listening: "Aan het luisteren…", describeMeal: "Beschrijf je maaltijd…",
    yourGoals: "Je dagelijkse doelen", todaysMeals: "Maaltijden van vandaag", recommendations: "Aanbevelingen",
  },
  ar: {
    today: "اليوم", log: "تسجيل وجبة", history: "السجل", insights: "تحليلات", settings: "الإعدادات",
    chooseLanguage: "اختر لغتك", language: "اللغة", profile: "الملف", signOut: "تسجيل الخروج",
    languageContinue: "متابعة", logIt: "حفظ", tryAgain: "حاول مجددًا", refresh: "تحديث", getStarted: "ابدأ",
    typeAnswer: "اكتب إجابتك…", listening: "جارٍ الاستماع…", describeMeal: "صف وجبتك…",
    yourGoals: "أهدافك اليومية", todaysMeals: "وجبات اليوم", recommendations: "التوصيات",
  },
  zh: {
    today: "今天", log: "记录餐食", history: "历史", insights: "分析", settings: "设置",
    chooseLanguage: "选择你的语言", language: "语言", profile: "个人资料", signOut: "退出登录",
    languageContinue: "继续", logIt: "保存", tryAgain: "重试", refresh: "刷新", getStarted: "开始",
    typeAnswer: "输入你的回答…", listening: "正在聆听…", describeMeal: "描述你的餐食…",
    yourGoals: "你的每日目标", todaysMeals: "今天的餐食", recommendations: "推荐",
  },
  ja: {
    today: "今日", log: "食事を記録", history: "履歴", insights: "分析", settings: "設定",
    chooseLanguage: "言語を選択", language: "言語", profile: "プロフィール", signOut: "ログアウト",
    languageContinue: "続ける", logIt: "保存", tryAgain: "再試行", refresh: "更新", getStarted: "始める",
    typeAnswer: "回答を入力…", listening: "聞いています…", describeMeal: "食事を入力…",
    yourGoals: "今日の目標", todaysMeals: "今日の食事", recommendations: "おすすめ",
  },
};

export function t(key: UIKey, lang?: LangCode): string {
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
