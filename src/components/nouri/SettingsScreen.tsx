import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  LANGUAGES,
  getLanguageMeta,
  setLanguage,
  useLanguage,
  t,
  type LangCode,
} from "@/lib/nouri-i18n";

interface Props {
  onClose: () => void;
}

const CONFIRMATIONS: Record<LangCode, (name: string) => string> = {
  en: (n) => `Language updated! Nouri will now speak ${n} with you 🌍`,
  fr: (n) => `Langue mise à jour ! Nouri parlera maintenant ${n} avec toi 🌍`,
  de: (n) => `Sprache aktualisiert! Nouri spricht jetzt ${n} mit dir 🌍`,
  es: (n) => `¡Idioma actualizado! Nouri ahora hablará ${n} contigo 🌍`,
  it: (n) => `Lingua aggiornata! Nouri parlerà ora ${n} con te 🌍`,
  pt: (n) => `Idioma atualizado! A Nouri vai falar ${n} contigo agora 🌍`,
  nl: (n) => `Taal bijgewerkt! Nouri spreekt nu ${n} met je 🌍`,
  ar: (n) => `تم تحديث اللغة! ستتحدث Nouri معك بـ ${n} الآن 🌍`,
  zh: (n) => `语言已更新！Nouri 现在将用${n}与你交流 🌍`,
  ja: (n) => `言語が更新されました！Nouri はこれから${n}で話します 🌍`,
};

export function SettingsScreen({ onClose }: Props) {
  const lang = useLanguage();
  const current = getLanguageMeta(lang);
  const [picking, setPicking] = useState(false);

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
            <span className="text-xl">⚙️</span>
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
          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="w-full flex items-center justify-between rounded-2xl border border-border bg-card hover:border-primary/40 px-4 py-3.5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌍</span>
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
                🌍 {t("chooseLanguage", lang)}
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
        </div>
      </div>
    </div>
  );
}
