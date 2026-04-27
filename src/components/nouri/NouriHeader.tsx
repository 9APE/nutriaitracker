import { LogOut } from "lucide-react";

export function NouriHeader({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-serif text-lg font-medium tracking-tight">Nouri</span>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </header>
  );
}
