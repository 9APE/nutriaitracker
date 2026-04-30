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
  // Today screen / nutrition
  "caloriesEaten", "remaining", "goal", "kcal", "protein", "carbs", "fat",
  "logTraining", "trainingBumps", "trainingLogged", "logMealCta",
  "nothingLoggedYet", "weeklyCheckinTitle", "weeklyCheckinSub", "letsGo",
  // Remaining banner
  "allGoalsHit", "proteinGoalHit", "calorieGoalHit", "needMore",
  // Header
  "signOutConfirm", "signedOut",
  // Log screen
  "logMealTitle", "logMealHelp", "stopRecording", "startRecording",
  "recordingTap", "transcribingAudio", "tapToRecord", "voiceUnsupported",
  "orTypeInstead", "logExamplePlaceholder", "calculatingMacros", "send",
  "tryAnExample", "describeMealFirst", "loggedToast", "logged",
  "anythingElse", "thinking", "didntCatchThat", "couldntAnalyse",
  "gotItPrefix", "tapLogIt", "kcalShort", "gShort",
  // History screen
  "historyTitle", "noMealsLogged", "mealsCount", "proteinShort",
  // Insights
  "insightsTitle", "avgProteinDay", "avgCaloriesDay",
  "caloriesLast7", "proteinLast7", "goalDot",
] as const;
export type UIKey = (typeof UI_KEYS)[number];

type Dict = Record<UIKey, string>;

const EN: Dict = {
  today: "Today", log: "Log Meal", history: "History", insights: "Insights", settings: "Settings",
  chooseLanguage: "Choose your language", language: "Language", profile: "Profile", signOut: "Sign out",
  languageContinue: "Continue", logIt: "Log it", tryAgain: "Try again", refresh: "Refresh", getStarted: "Get Started",
  typeAnswer: "Type your answer…", listening: "Listening…", describeMeal: "Describe your meal…",
  yourGoals: "Your daily goals", todaysMeals: "Today's meals", recommendations: "Recommendations",
  caloriesEaten: "Calories eaten", remaining: "Remaining", goal: "Goal", kcal: "kcal",
  protein: "Protein", carbs: "Carbs", fat: "Fat",
  logTraining: "Log training", trainingBumps: "Bumps today's protein target by {n}g.",
  trainingLogged: "Training logged — protein target +{n}g today.",
  logMealCta: "Log a meal with voice or text 🎤",
  nothingLoggedYet: "Nothing logged yet — tap the button above to add your first meal.",
  weeklyCheckinTitle: "Time for your weekly check-in",
  weeklyCheckinSub: "A quick chat with Nouri to fine-tune your goals.",
  letsGo: "Let's go",
  allGoalsHit: "You've hit all your goals today! 🌿 Great work.",
  proteinGoalHit: "Protein goal hit! ✅ Focus on your {kcal} kcal remaining.",
  calorieGoalHit: "Calorie goal hit! Just {g}g more protein to go.",
  needMore: "You need {g}g more protein and {kcal} kcal today.",
  signOutConfirm: "Sign out of Nouri?", signedOut: "Signed out",
  // Log screen
  logMealTitle: "Log a Meal",
  logMealHelp: "Tap the mic and describe what you ate. I'll do the math.",
  stopRecording: "Stop recording", startRecording: "Start recording",
  recordingTap: "Recording… tap to stop",
  transcribingAudio: "Transcribing your audio…",
  tapToRecord: "Tap to start recording",
  voiceUnsupported: "Voice not supported — type below",
  orTypeInstead: "or type instead",
  logExamplePlaceholder: "e.g. 100g rice, 150g grilled chicken, a tablespoon of olive oil",
  calculatingMacros: "Calculating macros…",
  send: "Send",
  tryAnExample: "Try an example",
  describeMealFirst: "Describe your meal first",
  loggedToast: "Logged {name}",
  logged: "Logged",
  anythingElse: "Anything else?",
  thinking: "Thinking…",
  didntCatchThat: "I didn't catch that — could you try again or type your meal below?",
  couldntAnalyse: "Sorry — I couldn't analyse that ({err}). Try rephrasing with quantities, e.g. \"150g chicken, 80g rice\".",
  gotItPrefix: "Got it",
  tapLogIt: "Tap **Log it** to save.",
  kcalShort: "kcal", gShort: "g",
  // History
  historyTitle: "History", noMealsLogged: "No meals logged yet.",
  mealsCount: "{n} meals", proteinShort: "protein",
  // Insights
  insightsTitle: "Insights",
  avgProteinDay: "Avg Protein / day", avgCaloriesDay: "Avg Calories / day",
  caloriesLast7: "Calories — last 7 days", proteinLast7: "Protein — last 7 days",
  goalDot: "Goal",
};

const STRINGS: Record<LangCode, Partial<Dict>> = {
  en: EN,
  fr: {
    today: "Aujourd'hui", log: "Ajouter un repas", history: "Historique", insights: "Aperçus", settings: "Paramètres",
    chooseLanguage: "Choisissez votre langue", language: "Langue", profile: "Profil", signOut: "Déconnexion",
    languageContinue: "Continuer", logIt: "Enregistrer", tryAgain: "Réessayer", refresh: "Actualiser", getStarted: "Commencer",
    typeAnswer: "Tapez votre réponse…", listening: "Écoute…", describeMeal: "Décrivez votre repas…",
    yourGoals: "Vos objectifs quotidiens", todaysMeals: "Repas du jour", recommendations: "Recommandations",
    caloriesEaten: "Calories consommées", remaining: "Restantes", goal: "Objectif", kcal: "kcal",
    protein: "Protéines", carbs: "Glucides", fat: "Lipides",
    logTraining: "Enregistrer un entraînement", trainingBumps: "Augmente l'objectif de protéines de {n}g aujourd'hui.",
    trainingLogged: "Entraînement enregistré — objectif protéines +{n}g aujourd'hui.",
    logMealCta: "Enregistrez un repas par voix ou texte 🎤",
    nothingLoggedYet: "Rien d'enregistré — appuyez ci-dessus pour ajouter votre premier repas.",
    weeklyCheckinTitle: "C'est l'heure de votre bilan hebdomadaire",
    weeklyCheckinSub: "Une petite conversation avec Nouri pour ajuster vos objectifs.",
    letsGo: "C'est parti",
    allGoalsHit: "Vous avez atteint tous vos objectifs aujourd'hui ! 🌿 Bravo.",
    proteinGoalHit: "Objectif protéines atteint ! ✅ Il vous reste {kcal} kcal.",
    calorieGoalHit: "Objectif calories atteint ! Encore {g}g de protéines.",
    needMore: "Il vous faut {g}g de protéines et {kcal} kcal aujourd'hui.",
    signOutConfirm: "Se déconnecter de Nouri ?", signedOut: "Déconnecté",
  },
  de: {
    today: "Heute", log: "Mahlzeit eintragen", history: "Verlauf", insights: "Einblicke", settings: "Einstellungen",
    chooseLanguage: "Wähle deine Sprache", language: "Sprache", profile: "Profil", signOut: "Abmelden",
    languageContinue: "Weiter", logIt: "Speichern", tryAgain: "Nochmal", refresh: "Aktualisieren", getStarted: "Loslegen",
    typeAnswer: "Antwort eingeben…", listening: "Höre zu…", describeMeal: "Beschreibe deine Mahlzeit…",
    yourGoals: "Deine Tagesziele", todaysMeals: "Heutige Mahlzeiten", recommendations: "Empfehlungen",
    caloriesEaten: "Kalorien gegessen", remaining: "Verbleibend", goal: "Ziel", kcal: "kcal",
    protein: "Eiweiß", carbs: "Kohlenhydrate", fat: "Fett",
    logTraining: "Training eintragen", trainingBumps: "Erhöht das heutige Eiweißziel um {n}g.",
    trainingLogged: "Training eingetragen — Eiweißziel +{n}g heute.",
    logMealCta: "Mahlzeit per Sprache oder Text eintragen 🎤",
    nothingLoggedYet: "Noch nichts eingetragen — tippe oben, um die erste Mahlzeit hinzuzufügen.",
    weeklyCheckinTitle: "Zeit für deinen wöchentlichen Check-in",
    weeklyCheckinSub: "Ein kurzes Gespräch mit Nouri, um deine Ziele zu justieren.",
    letsGo: "Los geht's",
    allGoalsHit: "Du hast heute alle Ziele erreicht! 🌿 Klasse.",
    proteinGoalHit: "Eiweißziel erreicht! ✅ Noch {kcal} kcal übrig.",
    calorieGoalHit: "Kalorienziel erreicht! Noch {g}g Eiweiß.",
    needMore: "Du brauchst heute noch {g}g Eiweiß und {kcal} kcal.",
    signOutConfirm: "Von Nouri abmelden?", signedOut: "Abgemeldet",
  },
  es: {
    today: "Hoy", log: "Registrar comida", history: "Historial", insights: "Análisis", settings: "Ajustes",
    chooseLanguage: "Elige tu idioma", language: "Idioma", profile: "Perfil", signOut: "Cerrar sesión",
    languageContinue: "Continuar", logIt: "Guardar", tryAgain: "Reintentar", refresh: "Actualizar", getStarted: "Empezar",
    typeAnswer: "Escribe tu respuesta…", listening: "Escuchando…", describeMeal: "Describe tu comida…",
    yourGoals: "Tus objetivos diarios", todaysMeals: "Comidas de hoy", recommendations: "Recomendaciones",
    caloriesEaten: "Calorías consumidas", remaining: "Restantes", goal: "Objetivo", kcal: "kcal",
    protein: "Proteínas", carbs: "Carbohidratos", fat: "Grasas",
    logTraining: "Registrar entrenamiento", trainingBumps: "Aumenta el objetivo de proteínas hoy en {n}g.",
    trainingLogged: "Entrenamiento registrado — objetivo de proteínas +{n}g hoy.",
    logMealCta: "Registra una comida por voz o texto 🎤",
    nothingLoggedYet: "Nada registrado — pulsa arriba para añadir tu primera comida.",
    weeklyCheckinTitle: "Es hora de tu revisión semanal",
    weeklyCheckinSub: "Una charla breve con Nouri para ajustar tus objetivos.",
    letsGo: "Vamos",
    allGoalsHit: "¡Has cumplido todos tus objetivos hoy! 🌿 Bien hecho.",
    proteinGoalHit: "¡Objetivo de proteínas cumplido! ✅ Te quedan {kcal} kcal.",
    calorieGoalHit: "¡Objetivo de calorías cumplido! Solo {g}g más de proteína.",
    needMore: "Necesitas {g}g más de proteína y {kcal} kcal hoy.",
    signOutConfirm: "¿Cerrar sesión en Nouri?", signedOut: "Sesión cerrada",
  },
  it: {
    today: "Oggi", log: "Registra pasto", history: "Cronologia", insights: "Analisi", settings: "Impostazioni",
    chooseLanguage: "Scegli la tua lingua", language: "Lingua", profile: "Profilo", signOut: "Esci",
    languageContinue: "Continua", logIt: "Salva", tryAgain: "Riprova", refresh: "Aggiorna", getStarted: "Inizia",
    typeAnswer: "Scrivi la tua risposta…", listening: "In ascolto…", describeMeal: "Descrivi il tuo pasto…",
    yourGoals: "I tuoi obiettivi giornalieri", todaysMeals: "Pasti di oggi", recommendations: "Consigli",
    caloriesEaten: "Calorie consumate", remaining: "Rimanenti", goal: "Obiettivo", kcal: "kcal",
    protein: "Proteine", carbs: "Carboidrati", fat: "Grassi",
    logTraining: "Registra allenamento", trainingBumps: "Aumenta l'obiettivo di proteine di {n}g oggi.",
    trainingLogged: "Allenamento registrato — obiettivo proteine +{n}g oggi.",
    logMealCta: "Registra un pasto con voce o testo 🎤",
    nothingLoggedYet: "Nulla registrato — tocca sopra per aggiungere il primo pasto.",
    weeklyCheckinTitle: "È ora del tuo check-in settimanale",
    weeklyCheckinSub: "Una breve chat con Nouri per regolare i tuoi obiettivi.",
    letsGo: "Andiamo",
    allGoalsHit: "Hai raggiunto tutti i tuoi obiettivi oggi! 🌿 Bravo.",
    proteinGoalHit: "Obiettivo proteine raggiunto! ✅ Restano {kcal} kcal.",
    calorieGoalHit: "Obiettivo calorie raggiunto! Solo {g}g di proteine in più.",
    needMore: "Ti servono {g}g di proteine e {kcal} kcal oggi.",
    signOutConfirm: "Uscire da Nouri?", signedOut: "Disconnesso",
  },
  pt: {
    today: "Hoje", log: "Registar refeição", history: "Histórico", insights: "Análises", settings: "Definições",
    chooseLanguage: "Escolha o seu idioma", language: "Idioma", profile: "Perfil", signOut: "Sair",
    languageContinue: "Continuar", logIt: "Guardar", tryAgain: "Tentar de novo", refresh: "Atualizar", getStarted: "Começar",
    typeAnswer: "Escreva a sua resposta…", listening: "A ouvir…", describeMeal: "Descreva a sua refeição…",
    yourGoals: "Os seus objetivos diários", todaysMeals: "Refeições de hoje", recommendations: "Recomendações",
    caloriesEaten: "Calorias consumidas", remaining: "Restantes", goal: "Objetivo", kcal: "kcal",
    protein: "Proteínas", carbs: "Hidratos", fat: "Gorduras",
    logTraining: "Registar treino", trainingBumps: "Aumenta o objetivo de proteína em {n}g hoje.",
    trainingLogged: "Treino registado — objetivo de proteína +{n}g hoje.",
    logMealCta: "Registe uma refeição por voz ou texto 🎤",
    nothingLoggedYet: "Nada registado — toque acima para adicionar a primeira refeição.",
    weeklyCheckinTitle: "Hora do seu check-in semanal",
    weeklyCheckinSub: "Uma conversa rápida com a Nouri para ajustar os objetivos.",
    letsGo: "Vamos",
    allGoalsHit: "Atingiu todos os objetivos hoje! 🌿 Excelente.",
    proteinGoalHit: "Objetivo de proteína atingido! ✅ Faltam {kcal} kcal.",
    calorieGoalHit: "Objetivo de calorias atingido! Só mais {g}g de proteína.",
    needMore: "Precisa de mais {g}g de proteína e {kcal} kcal hoje.",
    signOutConfirm: "Sair da Nouri?", signedOut: "Sessão terminada",
  },
  nl: {
    today: "Vandaag", log: "Maaltijd loggen", history: "Geschiedenis", insights: "Inzichten", settings: "Instellingen",
    chooseLanguage: "Kies je taal", language: "Taal", profile: "Profiel", signOut: "Uitloggen",
    languageContinue: "Doorgaan", logIt: "Opslaan", tryAgain: "Opnieuw", refresh: "Vernieuwen", getStarted: "Beginnen",
    typeAnswer: "Typ je antwoord…", listening: "Aan het luisteren…", describeMeal: "Beschrijf je maaltijd…",
    yourGoals: "Je dagelijkse doelen", todaysMeals: "Maaltijden van vandaag", recommendations: "Aanbevelingen",
    caloriesEaten: "Calorieën gegeten", remaining: "Resterend", goal: "Doel", kcal: "kcal",
    protein: "Eiwit", carbs: "Koolhydraten", fat: "Vet",
    logTraining: "Training loggen", trainingBumps: "Verhoogt je eiwitdoel vandaag met {n}g.",
    trainingLogged: "Training gelogd — eiwitdoel +{n}g vandaag.",
    logMealCta: "Log een maaltijd met spraak of tekst 🎤",
    nothingLoggedYet: "Nog niets gelogd — tik hierboven om je eerste maaltijd toe te voegen.",
    weeklyCheckinTitle: "Tijd voor je wekelijkse check-in",
    weeklyCheckinSub: "Een korte chat met Nouri om je doelen bij te stellen.",
    letsGo: "Let's go",
    allGoalsHit: "Je hebt vandaag al je doelen gehaald! 🌿 Top.",
    proteinGoalHit: "Eiwitdoel gehaald! ✅ Nog {kcal} kcal te gaan.",
    calorieGoalHit: "Caloriedoel gehaald! Nog {g}g eiwit te gaan.",
    needMore: "Je hebt vandaag nog {g}g eiwit en {kcal} kcal nodig.",
    signOutConfirm: "Uitloggen bij Nouri?", signedOut: "Uitgelogd",
  },
  ar: {
    today: "اليوم", log: "تسجيل وجبة", history: "السجل", insights: "تحليلات", settings: "الإعدادات",
    chooseLanguage: "اختر لغتك", language: "اللغة", profile: "الملف", signOut: "تسجيل الخروج",
    languageContinue: "متابعة", logIt: "حفظ", tryAgain: "حاول مجددًا", refresh: "تحديث", getStarted: "ابدأ",
    typeAnswer: "اكتب إجابتك…", listening: "جارٍ الاستماع…", describeMeal: "صف وجبتك…",
    yourGoals: "أهدافك اليومية", todaysMeals: "وجبات اليوم", recommendations: "التوصيات",
    caloriesEaten: "السعرات المتناولة", remaining: "المتبقي", goal: "الهدف", kcal: "سعرة",
    protein: "بروتين", carbs: "كربوهيدرات", fat: "دهون",
    logTraining: "تسجيل تدريب", trainingBumps: "يزيد هدف البروتين اليوم بمقدار {n}غ.",
    trainingLogged: "تم تسجيل التدريب — هدف البروتين +{n}غ اليوم.",
    logMealCta: "سجّل وجبة بالصوت أو النص 🎤",
    nothingLoggedYet: "لا شيء بعد — اضغط بالأعلى لإضافة وجبتك الأولى.",
    weeklyCheckinTitle: "حان وقت مراجعتك الأسبوعية",
    weeklyCheckinSub: "محادثة سريعة مع Nouri لضبط أهدافك.",
    letsGo: "هيا بنا",
    allGoalsHit: "حققت كل أهدافك اليوم! 🌿 أحسنت.",
    proteinGoalHit: "تحقق هدف البروتين! ✅ متبقي {kcal} سعرة.",
    calorieGoalHit: "تحقق هدف السعرات! متبقي {g}غ بروتين.",
    needMore: "تحتاج {g}غ بروتين و {kcal} سعرة اليوم.",
    signOutConfirm: "تسجيل الخروج من Nouri؟", signedOut: "تم تسجيل الخروج",
  },
  zh: {
    today: "今天", log: "记录餐食", history: "历史", insights: "分析", settings: "设置",
    chooseLanguage: "选择你的语言", language: "语言", profile: "个人资料", signOut: "退出登录",
    languageContinue: "继续", logIt: "保存", tryAgain: "重试", refresh: "刷新", getStarted: "开始",
    typeAnswer: "输入你的回答…", listening: "正在聆听…", describeMeal: "描述你的餐食…",
    yourGoals: "你的每日目标", todaysMeals: "今天的餐食", recommendations: "推荐",
    caloriesEaten: "已摄入热量", remaining: "剩余", goal: "目标", kcal: "千卡",
    protein: "蛋白质", carbs: "碳水", fat: "脂肪",
    logTraining: "记录训练", trainingBumps: "今日蛋白质目标提升 {n}克。",
    trainingLogged: "训练已记录 — 今日蛋白质目标 +{n}克。",
    logMealCta: "用语音或文字记录一餐 🎤",
    nothingLoggedYet: "还没有记录 — 点击上方添加你的第一餐。",
    weeklyCheckinTitle: "到了每周回顾时间",
    weeklyCheckinSub: "和 Nouri 简短聊聊，调整你的目标。",
    letsGo: "出发",
    allGoalsHit: "今天达成了所有目标！🌿 太棒了。",
    proteinGoalHit: "蛋白质达标！✅ 还剩 {kcal} 千卡。",
    calorieGoalHit: "热量达标！再补 {g}克蛋白质就好。",
    needMore: "今天还需要 {g}克蛋白质和 {kcal} 千卡。",
    signOutConfirm: "退出 Nouri？", signedOut: "已退出",
  },
  ja: {
    today: "今日", log: "食事を記録", history: "履歴", insights: "分析", settings: "設定",
    chooseLanguage: "言語を選択", language: "言語", profile: "プロフィール", signOut: "ログアウト",
    languageContinue: "続ける", logIt: "保存", tryAgain: "再試行", refresh: "更新", getStarted: "始める",
    typeAnswer: "回答を入力…", listening: "聞いています…", describeMeal: "食事を入力…",
    yourGoals: "今日の目標", todaysMeals: "今日の食事", recommendations: "おすすめ",
    caloriesEaten: "摂取カロリー", remaining: "残り", goal: "目標", kcal: "kcal",
    protein: "タンパク質", carbs: "炭水化物", fat: "脂質",
    logTraining: "トレーニングを記録", trainingBumps: "今日のタンパク質目標が {n}g 増えます。",
    trainingLogged: "トレーニング記録済み — 今日のタンパク質目標 +{n}g。",
    logMealCta: "音声またはテキストで食事を記録 🎤",
    nothingLoggedYet: "まだ記録なし — 上のボタンで最初の食事を追加。",
    weeklyCheckinTitle: "週次チェックインの時間です",
    weeklyCheckinSub: "Nouri と短く話して目標を調整しましょう。",
    letsGo: "始めよう",
    allGoalsHit: "今日の目標をすべて達成！🌿 お見事。",
    proteinGoalHit: "タンパク質目標達成！✅ 残り {kcal} kcal。",
    calorieGoalHit: "カロリー目標達成！あとタンパク質 {g}g。",
    needMore: "今日はあとタンパク質 {g}g とカロリー {kcal} kcal が必要。",
    signOutConfirm: "Nouri からログアウトしますか？", signedOut: "ログアウトしました",
  },
};

export function t(key: UIKey, lang?: LangCode, vars?: Record<string, string | number>): string {
  const code = lang ?? getLanguage() ?? "en";
  let s = STRINGS[code]?.[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
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
