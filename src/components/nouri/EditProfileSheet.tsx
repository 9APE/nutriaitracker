import { useState } from "react";
import { X, ChevronRight, Loader2, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cloud } from "@/lib/nouri-cloud";
import type { Goals } from "@/lib/nouri-storage";
import {
  saveUserProfile,
  saveUserWarnings,
  type UserProfile,
} from "@/components/nouri/ProfileChatOnboarding";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";

// ── Field metadata ───────────────────────────────────────────────────────────
type FieldKey =
  | "conditions"
  | "restrictions"
  | "activityLevel"
  | "dislikes"
  | "preferences";

const FIELD_LABELS: Record<FieldKey, string> = {
  conditions: "Edit health conditions",
  restrictions: "Edit dietary restrictions",
  activityLevel: "Edit activity level",
  dislikes: "Edit food dislikes",
  preferences: "Edit food preferences",
};

const FIELD_HELP: Record<FieldKey, string> = {
  conditions:
    "Anything Nouri should know about — diabetes, blood pressure, cholesterol, thyroid, etc.",
  restrictions:
    "Diets you follow — vegetarian, vegan, halal, kosher, gluten-free, dairy-free, etc.",
  activityLevel: "How active you are on a typical day.",
  dislikes: "Foods you'd rather not see in recommendations.",
  preferences: "Foods or cuisines you enjoy and want more of.",
};

const CHIP_OPTIONS: Partial<Record<FieldKey, string[]>> = {
  conditions: ["None", "Diabetes", "High blood pressure", "High cholesterol", "Thyroid", "Other"],
  restrictions: [
    "None",
    "Vegetarian",
    "Vegan",
    "Halal",
    "Kosher",
    "Gluten-free",
    "Dairy-free",
    "Other",
  ],
};

const ACTIVITY_OPTIONS = [
  "Sedentary",
  "Lightly active",
  "Moderately active",
  "Very active",
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function readField(profile: UserProfile, key: FieldKey): string[] | string {
  if (key === "activityLevel") return profile.activityLevel || "";
  return (profile[key] as string[] | undefined) ?? [];
}

function previewValue(profile: UserProfile, key: FieldKey): string {
  const v = readField(profile, key);
  if (typeof v === "string") return v || "—";
  if (!v.length) return "—";
  return v.join(", ");
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  profile: UserProfile;
  onClose: () => void;
  onProfileSaved: (next: UserProfile) => void;
  onGoalsRecalculated: (goals: Goals, warnings: string[]) => void;
  userId: string;
}

export function EditProfileSheet({
  profile,
  onClose,
  onProfileSaved,
  onGoalsRecalculated,
  userId,
}: Props) {
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fieldKeys: FieldKey[] = [
    "conditions",
    "restrictions",
    "activityLevel",
    "dislikes",
    "preferences",
  ];

  async function persistField(key: FieldKey, value: string[] | string) {
    const next: UserProfile = { ...profile, [key]: value } as UserProfile;
    saveUserProfile(next);
    try {
      await cloud.updateProfile(userId, { user_profile_json: next } as any);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save your profile");
      return;
    }
    onProfileSaved(next);
    setEditingField(null);
    toast.success("Profile updated ✓");
  }

  async function recalcGoals() {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-chat", {
        body: {
          mode: "goals",
          profile,
          language: getLanguage() ?? "en",
          languageName: getLanguageName(),
        },
      });
      if (error) throw new Error(error.message);
      const plan = data?.plan;
      if (!plan) throw new Error("No plan returned");
      const goals: Goals = {
        calories: Math.round(plan.calories),
        protein: Math.round(plan.protein),
        carbs: Math.round(plan.carbs),
        fat: Math.round(plan.fat),
      };
      const warnings: string[] = Array.isArray(plan.warnings) ? plan.warnings : [];
      await cloud.upsertGoals(userId, goals);
      await cloud.updateProfile(userId, { user_warnings_json: warnings } as any);
      saveUserWarnings(warnings);
      // Persist full extended goals locally (macros + micros + reasoning)
      const { saveUserGoals, parseWeightToKg } = await import("@/lib/nouri-goals");
      saveUserGoals({
        ...goals,
        fiber: plan.fiber,
        sugar_max: plan.sugar_max,
        saturated_fat_max: plan.saturated_fat_max,
        sodium_max: plan.sodium_max,
        cholesterol_max: plan.cholesterol_max,
        potassium: plan.potassium,
        calcium: plan.calcium,
        iron: plan.iron,
        vitamin_c: plan.vitamin_c,
        vitamin_d: plan.vitamin_d,
        vitamin_a: plan.vitamin_a,
        reasoning:
          plan.reasoning && typeof plan.reasoning === "object"
            ? plan.reasoning
            : plan.reasoning
            ? { calories: String(plan.reasoning) }
            : undefined,
        bodyweight_kg: parseWeightToKg(profile.weight),
        calibrated_at: new Date().toISOString(),
      });
      onGoalsRecalculated(goals, warnings);
      toast.success("Goals recalculated ✓");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't recalculate goals");
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up max-h-[90vh] flex flex-col"
        role="dialog"
        aria-label="Edit profile"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-lg font-medium">Edit profile</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
          {fieldKeys.map((key) => (
            <button
              key={key}
              onClick={() => setEditingField(key)}
              className="w-full flex items-center justify-between rounded-2xl border border-border bg-card hover:border-primary/40 px-4 py-3 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{FIELD_LABELS[key]}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {previewValue(profile, key)}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0 ml-3" />
            </button>
          ))}

          <div className="pt-4">
            <Button
              onClick={recalcGoals}
              disabled={recalculating}
              variant="outline"
              className="w-full h-12 text-base"
            >
              {recalculating ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Recalculating…
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="mr-2" />
                  Recalculate my goals
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 px-1 leading-relaxed">
              Re-runs the AI calculation using your updated profile. Your existing daily
              targets stay until you confirm new ones.
            </p>
          </div>
        </div>
      </div>

      {editingField && (
        <FieldEditor
          fieldKey={editingField}
          initialValue={readField(profile, editingField)}
          onCancel={() => setEditingField(null)}
          onSave={(v) => persistField(editingField, v)}
        />
      )}
    </div>
  );
}

// ── Inner field editor modal ─────────────────────────────────────────────────
function FieldEditor({
  fieldKey,
  initialValue,
  onCancel,
  onSave,
}: {
  fieldKey: FieldKey;
  initialValue: string[] | string;
  onCancel: () => void;
  onSave: (v: string[] | string) => void | Promise<void>;
}) {
  const isSingle = fieldKey === "activityLevel";
  const chips = CHIP_OPTIONS[fieldKey];
  const [single, setSingle] = useState<string>(typeof initialValue === "string" ? initialValue : "");
  const [list, setList] = useState<string[]>(
    Array.isArray(initialValue) ? [...initialValue] : [],
  );
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleChip(label: string) {
    setList((cur) => {
      const exists = cur.some((x) => x.toLowerCase() === label.toLowerCase());
      return exists ? cur.filter((x) => x.toLowerCase() !== label.toLowerCase()) : [...cur, label];
    });
  }

  function addCustom() {
    const v = draft.trim();
    if (!v) return;
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    setList((cur) => [...cur, v]);
    setDraft("");
  }

  function removeItem(label: string) {
    setList((cur) => cur.filter((x) => x !== label));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(isSingle ? single : list);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-card animate-slide-up max-h-[90vh] flex flex-col"
        role="dialog"
        aria-label={FIELD_LABELS[fieldKey]}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-serif text-base font-medium">{FIELD_LABELS[fieldKey]}</h3>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{FIELD_HELP[fieldKey]}</p>

          {isSingle ? (
            <div className="grid grid-cols-1 gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const sel = single.toLowerCase() === opt.toLowerCase();
                return (
                  <button
                    key={opt}
                    onClick={() => setSingle(opt)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      sel
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-sm font-medium">{opt}</span>
                    {sel && <Check size={16} className="text-primary" />}
                  </button>
                );
              })}
              <Input
                value={single}
                onChange={(e) => setSingle(e.target.value)}
                placeholder="Or type your own…"
                className="mt-1"
              />
            </div>
          ) : (
            <>
              {chips && chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chips.map((label) => {
                    const sel = list.some((x) => x.toLowerCase() === label.toLowerCase());
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleChip(label)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          sel
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addCustom();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add your own…"
                  className="flex-1"
                />
                <Button type="submit" variant="outline" disabled={!draft.trim()}>
                  Add
                </Button>
              </form>

              {list.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground px-1">Selected</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 pl-3 pr-1.5 py-1 text-sm"
                      >
                        {item}
                        <button
                          onClick={() => removeItem(item)}
                          className="rounded-full hover:bg-primary/20 p-0.5"
                          aria-label={`Remove ${item}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-border flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onCancel} className="flex-1 h-11">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-11">
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
