import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage, t } from "@/lib/nouri-i18n";

export function NouriHeader({
  onSignOut,
  rightSlot,
}: {
  onSignOut: () => void;
  rightSlot?: ReactNode;
}) {
  const lang = useLanguage();
  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          
          <span className="font-serif text-lg font-medium tracking-tight">NutriAI</span>
        </div>
        <div className="flex items-center gap-1">
          {rightSlot}
          <button
            onClick={onSignOut}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <LogOut size={13} />
            {t("signOut", lang)}
          </button>
        </div>
      </div>
    </header>
  );
}
