import { useEffect, useState } from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resolveBarcode,
  saveCustomFood,
  buildMealFromProduct,
  type FoodProduct,
} from "@/lib/nouri-foods";
import { todayISO, type Meal } from "@/lib/nouri-storage";
import { toast } from "sonner";

type Phase = "loading" | "found" | "not-found" | "error";

interface Props {
  barcode: string;
  onClose: () => void;
  onMealReady: (draft: Omit<Meal, "id" | "created_at">) => void;
}

const PORTION_PRESETS = [100, 150, 200];

export function BarcodeProductSheet({ barcode, onClose, onMealReady }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Portion picker state
  const [portion, setPortion] = useState<number>(100);
  const [customPortion, setCustomPortion] = useState<string>("");

  // Manual-entry state
  const [manual, setManual] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await resolveBarcode(barcode);
        if (cancelled) return;
        if (p) {
          setProduct(p);
          setPhase("found");
        } else {
          setPhase("not-found");
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Couldn't reach Open Food Facts");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  const effectivePortion = (() => {
    if (portion > 0) return portion;
    const n = parseFloat(customPortion);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  function confirmFromProduct() {
    if (!product || effectivePortion <= 0) return;
    const draft = buildMealFromProduct(product, effectivePortion, todayISO(), "Snack");
    onMealReady(draft);
  }

  function confirmFromManual() {
    const name = manual.name.trim();
    const cal = parseFloat(manual.calories);
    const pr = parseFloat(manual.protein);
    const cb = parseFloat(manual.carbs);
    const ft = parseFloat(manual.fat);
    if (!name || !Number.isFinite(cal)) {
      toast.error("Add a name and calories per 100g");
      return;
    }
    const newProduct: FoodProduct = {
      barcode,
      name,
      caloriesPer100g: Math.round(cal),
      proteinPer100g: Number.isFinite(pr) ? pr : 0,
      carbsPer100g: Number.isFinite(cb) ? cb : 0,
      fatPer100g: Number.isFinite(ft) ? ft : 0,
      source: "custom",
    };
    saveCustomFood(newProduct);
    toast.success("Saved — future scans will load instantly");
    const draft = buildMealFromProduct(newProduct, 100, todayISO(), "Snack");
    onMealReady(draft);
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-serif text-lg font-medium">
            {phase === "loading"
              ? "Looking up product…"
              : phase === "found"
                ? "Choose portion"
                : phase === "not-found"
                  ? "Add it manually"
                  : "Something went wrong"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm">Fetching from Open Food Facts…</p>
              <p className="text-xs font-mono-data">{barcode}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <AlertCircle size={28} className="text-destructive" />
              <p className="text-sm">{error}</p>
              <Button onClick={onClose} variant="outline" className="mt-2">
                Close
              </Button>
            </div>
          )}

          {phase === "found" && product && (
            <div className="space-y-5">
              <div>
                <h4 className="font-serif text-xl leading-tight">{product.name}</h4>
                {product.brand && (
                  <p className="text-sm text-muted-foreground mt-0.5">{product.brand}</p>
                )}
                <p className="text-[11px] text-muted-foreground font-mono-data mt-1">
                  {product.source === "custom" ? "Saved locally" : "Open Food Facts"} · {barcode}
                </p>
              </div>

              <section className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Per 100g
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="kcal" value={product.caloriesPer100g} />
                  <Stat label="protein" value={`${product.proteinPer100g}g`} />
                  <Stat label="carbs" value={`${product.carbsPer100g}g`} />
                  <Stat label="fat" value={`${product.fatPer100g}g`} />
                </div>
              </section>

              <section>
                <div className="text-sm font-medium mb-2">Portion size</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {PORTION_PRESETS.map((g) => {
                    const sel = portion === g;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setPortion(g);
                          setCustomPortion("");
                        }}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          sel
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {g}g
                      </button>
                    );
                  })}
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  placeholder="Custom (g)"
                  value={customPortion}
                  onChange={(e) => {
                    setCustomPortion(e.target.value);
                    setPortion(0);
                  }}
                />
              </section>

              {effectivePortion > 0 && (
                <section className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    For {effectivePortion}g
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat
                      label="kcal"
                      value={Math.round((product.caloriesPer100g * effectivePortion) / 100)}
                    />
                    <Stat
                      label="protein"
                      value={`${Math.round((product.proteinPer100g * effectivePortion) / 100)}g`}
                    />
                    <Stat
                      label="carbs"
                      value={`${Math.round((product.carbsPer100g * effectivePortion) / 100)}g`}
                    />
                    <Stat
                      label="fat"
                      value={`${Math.round((product.fatPer100g * effectivePortion) / 100)}g`}
                    />
                  </div>
                </section>
              )}
            </div>
          )}

          {phase === "not-found" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-foreground">Product not found — add it manually.</p>
                <p className="text-[11px] text-muted-foreground font-mono-data mt-1">
                  Barcode: {barcode}
                </p>
              </div>

              <div className="space-y-3">
                <Field
                  label="Product name"
                  value={manual.name}
                  onChange={(v) => setManual((m) => ({ ...m, name: v }))}
                  placeholder="e.g. Granola"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Calories / 100g"
                    type="number"
                    value={manual.calories}
                    onChange={(v) => setManual((m) => ({ ...m, calories: v }))}
                  />
                  <Field
                    label="Protein / 100g"
                    type="number"
                    value={manual.protein}
                    onChange={(v) => setManual((m) => ({ ...m, protein: v }))}
                  />
                  <Field
                    label="Carbs / 100g"
                    type="number"
                    value={manual.carbs}
                    onChange={(v) => setManual((m) => ({ ...m, carbs: v }))}
                  />
                  <Field
                    label="Fat / 100g"
                    type="number"
                    value={manual.fat}
                    onChange={(v) => setManual((m) => ({ ...m, fat: v }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved to this device — next scan of this barcode will load instantly.
                </p>
              </div>
            </div>
          )}
        </div>

        {(phase === "found" || phase === "not-found") && (
          <footer className="px-5 py-4 border-t border-border flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11">
              Cancel
            </Button>
            <Button
              onClick={phase === "found" ? confirmFromProduct : confirmFromManual}
              disabled={phase === "found" && effectivePortion <= 0}
              className="flex-1 h-11"
            >
              Continue
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono-data text-base font-medium leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </label>
  );
}
