import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LANGUAGES, setLanguage, type LangCode, t } from "@/lib/nouri-i18n";

interface Props {
  onDone: (code: LangCode) => void;
}

export function LanguageSelect({ onDone }: Props) {
  const [selected, setSelected] = useState<LangCode | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    setLanguage(selected);
    onDone(selected);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-serif text-lg font-medium">Nouri</span>
        </div>
      </header>

      <div className="flex-1 px-5 py-8 overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          <h1 className="font-serif text-2xl font-medium text-center mb-1">
            {selected ? t("chooseLanguage", selected) : "Choose your language"}
          </h1>
          <p className="text-center text-sm text-muted-foreground mb-6">🌍</p>

          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((l) => {
              const isSel = selected === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setSelected(l.code)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                    isSel
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                  dir={l.rtl ? "rtl" : "ltr"}
                >
                  <span className="text-2xl shrink-0">{l.flag}</span>
                  <span className="text-sm font-medium leading-tight">
                    {l.native}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full h-12 text-base mt-8"
          >
            {selected ? t("languageContinue", selected) : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
