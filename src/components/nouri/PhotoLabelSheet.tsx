import { useEffect, useRef, useState } from "react";
import { Loader2, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseNutritionLabel,
  saveCustomFood,
  buildMealFromProduct,
  type FoodProduct,
} from "@/lib/nouri-foods";
import { todayISO, type Meal } from "@/lib/nouri-storage";
import { toast } from "sonner";

type Phase = "ocr" | "review" | "portion";

interface Props {
  /** Image file from the device camera (capture="environment"). */
  file: File;
  /** Barcode from the failed scan (used as a key in customFoods). */
  barcode: string;
  onClose: () => void;
  onMealReady: (draft: Omit<Meal, "id" | "created_at">) => void;
}

const PORTION_PRESETS = [100, 150, 200];

export function PhotoLabelSheet({ file, barcode, onClose, onMealReady }: Props) {
  const [phase, setPhase] = useState<Phase>("ocr");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<FoodProduct | null>(null);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sugar: "",
    saturated_fat: "",
    sodium: "",
  });

  const [portion, setPortion] = useState<number>(100);
  const [customPortion, setCustomPortion] = useState<string>("");

  const startedRef = useRef(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Run OCR exactly once
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const Tesseract = (await import("tesseract.js")).default;
        const { data } = await Tesseract.recognize(file, "eng", {
          logger: (m: any) => {
            if (cancelled) return;
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        if (cancelled) return;
        const parsed = parseNutritionLabel(data?.text ?? "");
        setForm({
          name: parsed.name ?? "",
          brand: parsed.brand ?? "",
          calories: parsed.caloriesPer100g != null ? String(parsed.caloriesPer100g) : "",
          protein: parsed.proteinPer100g != null ? String(parsed.proteinPer100g) : "",
          carbs: parsed.carbsPer100g != null ? String(parsed.carbsPer100g) : "",
          fat: parsed.fatPer100g != null ? String(parsed.fatPer100g) : "",
          fiber: parsed.fiberPer100g != null ? String(parsed.fiberPer100g) : "",
          sugar: parsed.sugarPer100g != null ? String(parsed.sugarPer100g) : "",
          saturated_fat: parsed.saturatedFatPer100g != null ? String(parsed.saturatedFatPer100g) : "",
          sodium: parsed.sodiumPer100g != null ? String(parsed.sodiumPer100g) : "",
        });
        setPhase("review");
      } catch (e: any) {
        if (cancelled) return;
        toast.error(e?.message || "Couldn't read the label");
        setPhase("review"); // still let them fill manually
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const effectivePortion = (() => {
    if (portion > 0) return portion;
    const n = parseFloat(customPortion);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  function saveAndContinue() {
    const name = form.name.trim();
    const cal = parseFloat(form.calories);
    if (!name || !Number.isFinite(cal)) {
      toast.error("Add a name and calories per 100g");
      return;
    }
    const microsPer100g: Record<string, number> = {};
    for (const k of ["fiber", "sugar", "saturated_fat", "sodium"] as const) {
      const v = parseFloat(form[k]);
      if (Number.isFinite(v) && v >= 0) microsPer100g[k] = v;
    }
    const product: FoodProduct = {
      barcode,
      name,
      brand: form.brand.trim() || undefined,
      caloriesPer100g: Math.round(cal),
      proteinPer100g: Number.isFinite(parseFloat(form.protein)) ? parseFloat(form.protein) : 0,
      carbsPer100g: Number.isFinite(parseFloat(form.carbs)) ? parseFloat(form.carbs) : 0,
      fatPer100g: Number.isFinite(parseFloat(form.fat)) ? parseFloat(form.fat) : 0,
      microsPer100g: Object.keys(microsPer100g).length ? microsPer100g : undefined,
      source: "custom",
    };
    saveCustomFood(product);
    setSavedProduct(product);
    toast.success("Product saved to your library");
    setPhase("portion");
  }

  function confirmPortion() {
    if (!savedProduct || effectivePortion <= 0) return;
    const draft = buildMealFromProduct(savedProduct, effectivePortion, todayISO(), "Snack");
    onMealReady(draft);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-serif text-lg font-medium">
            {phase === "ocr"
              ? "Reading the label…"
              : phase === "review"
                ? "Check the values"
                : "Choose portion"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {previewUrl && (
            <div className="rounded-xl overflow-hidden border border-border bg-muted">
              <img
                src={previewUrl}
                alt="Nutrition label"
                className="w-full max-h-48 object-cover"
              />
            </div>
          )}

          {phase === "ocr" && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-muted-foreground">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm">Extracting text from the photo…</p>
              <div className="w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] font-mono-data">{progress}%</p>
            </div>
          )}

          {phase === "review" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Camera size={14} className="mt-0.5 shrink-0" />
                Correct anything we misread, then save.
              </p>
              <Field
                label="Product name"
                value={form.name}
                onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                placeholder="e.g. Granola"
              />
              <Field
                label="Brand"
                value={form.brand}
                onChange={(v) => setForm((s) => ({ ...s, brand: v }))}
                placeholder="Optional"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Calories / 100g"
                  type="number"
                  value={form.calories}
                  onChange={(v) => setForm((s) => ({ ...s, calories: v }))}
                />
                <Field
                  label="Protein / 100g"
                  type="number"
                  value={form.protein}
                  onChange={(v) => setForm((s) => ({ ...s, protein: v }))}
                />
                <Field
                  label="Carbs / 100g"
                  type="number"
                  value={form.carbs}
                  onChange={(v) => setForm((s) => ({ ...s, carbs: v }))}
                />
                <Field
                  label="Fat / 100g"
                  type="number"
                  value={form.fat}
                  onChange={(v) => setForm((s) => ({ ...s, fat: v }))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono-data">
                Saved under barcode {barcode}
              </p>
            </div>
          )}

          {phase === "portion" && savedProduct && (
            <div className="space-y-5">
              <div>
                <h4 className="font-serif text-xl leading-tight">{savedProduct.name}</h4>
                {savedProduct.brand && (
                  <p className="text-sm text-muted-foreground mt-0.5">{savedProduct.brand}</p>
                )}
              </div>
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
                      value={Math.round((savedProduct.caloriesPer100g * effectivePortion) / 100)}
                    />
                    <Stat
                      label="protein"
                      value={`${Math.round((savedProduct.proteinPer100g * effectivePortion) / 100)}g`}
                    />
                    <Stat
                      label="carbs"
                      value={`${Math.round((savedProduct.carbsPer100g * effectivePortion) / 100)}g`}
                    />
                    <Stat
                      label="fat"
                      value={`${Math.round((savedProduct.fatPer100g * effectivePortion) / 100)}g`}
                    />
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {(phase === "review" || phase === "portion") && (
          <footer className="px-5 py-4 border-t border-border flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11">
              Cancel
            </Button>
            <Button
              onClick={phase === "review" ? saveAndContinue : confirmPortion}
              disabled={phase === "portion" && effectivePortion <= 0}
              className="flex-1 h-11"
            >
              {phase === "review" ? "Save & continue" : "Continue"}
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
