import { userScopedKey } from "@/lib/user-scoped-storage";

export interface FamilyMember {
  id: string;
  name: string;
  age?: number;
  sex?: string;
  height?: string;
  weight?: string;
  restrictions: string[];
  conditions: string[];
  allergies: string[];
  dislikes: string[];
  activityLevel?: string;
  goals?: string;
  cuisinePreferences?: string[];
  dailyTargets?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface DietProfile {
  hasVegan: boolean;
  hasVegetarian: boolean;
  hasMeatEater: boolean;
  /** True when the household contains BOTH a meat-eater AND a vegetarian/vegan. */
  mixed: boolean;
  /** Per-member protein targets keyed by name, used for split-protein meals. */
  proteinByMember: Record<string, number>;
}

export interface MergedFamilyRestrictions {
  restrictions: string[];
  conditions: string[];
  allergies: string[];
  dislikes: string[];
  cuisinePreferences: string[];
  memberNames: string[];
  hasConflictingConditions: boolean;
  conflictNote?: string;
  dietProfile: DietProfile;
}

export interface FamilyContextSnapshot {
  householdSize: number;
  memberProfiles: FamilyMember[];
  mergedRestrictions: MergedFamilyRestrictions;
}

const FAMILY_PROFILES_KEY = "nutriai:familyProfiles";
const FAMILY_MODE_KEY = "nutriai:familyMode";
const FAMILY_MERGED_KEY = "familyMergedRestrictions";
const HOUSEHOLD_SIZE_KEY = "nutriai:householdSize";

const OPPOSING_NUTRIENT_CONDITIONS: Record<string, string[]> = {
  potassium: ["Kidney Disease", "Hypertension"],
  protein: ["Kidney Disease", "Obesity"],
};

export function getFamilyMembers(): FamilyMember[] {
  try {
    const raw = localStorage.getItem(userScopedKey(FAMILY_PROFILES_KEY)) ?? localStorage.getItem(FAMILY_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as FamilyMember[]) : [];
  } catch {
    return [];
  }
}

export function saveFamilyMembers(members: FamilyMember[]) {
  const capped = members.slice(0, 10);
  localStorage.setItem(userScopedKey(FAMILY_PROFILES_KEY), JSON.stringify(capped));
  // Auto-regenerate merged restrictions whenever members change
  regenerateMergedRestrictions();
}

export function addFamilyMember(member: FamilyMember) {
  const members = getFamilyMembers();
  members.push(member);
  saveFamilyMembers(members);
}

export function updateFamilyMember(id: string, updates: Partial<FamilyMember>) {
  const members = getFamilyMembers();
  const idx = members.findIndex((m) => m.id === id);
  if (idx >= 0) {
    members[idx] = { ...members[idx], ...updates };
    saveFamilyMembers(members);
  }
}

export function removeFamilyMember(id: string) {
  saveFamilyMembers(getFamilyMembers().filter((m) => m.id !== id));
}

export function getHouseholdSize(): number {
  try {
    const stored = localStorage.getItem(userScopedKey(HOUSEHOLD_SIZE_KEY)) ?? localStorage.getItem(HOUSEHOLD_SIZE_KEY);
    if (stored) return Math.max(1, Math.min(8, parseInt(stored, 10) || 1));
  } catch {}
  return getFamilyMembers().length + 1;
}

export function setHouseholdSize(size: number) {
  localStorage.setItem(userScopedKey(HOUSEHOLD_SIZE_KEY), String(Math.max(1, Math.min(8, size))));
}

export function isFamilyMode(): boolean {
  return (localStorage.getItem(userScopedKey(FAMILY_MODE_KEY)) ?? localStorage.getItem(FAMILY_MODE_KEY)) === "true";
}

export function setFamilyMode(enabled: boolean) {
  localStorage.setItem(userScopedKey(FAMILY_MODE_KEY), enabled ? "true" : "false");
}

export function getMergedFamilyRestrictions(): MergedFamilyRestrictions {
  // Try to load cached merged restrictions first
  try {
    const cached = localStorage.getItem(userScopedKey(FAMILY_MERGED_KEY)) ?? localStorage.getItem(FAMILY_MERGED_KEY);
    if (cached) return JSON.parse(cached) as MergedFamilyRestrictions;
  } catch {}
  return computeMergedRestrictions();
}

export function computeMergedRestrictionsFromMembers(
  self: Record<string, any>,
  members: FamilyMember[],
): MergedFamilyRestrictions {
  const all: Array<Partial<FamilyMember>> = [self, ...members];
  const allConditions = [...new Set(all.flatMap((m) => m.conditions ?? []))];

  let hasConflictingConditions = false;
  let conflictNote: string | undefined;
  for (const [nutrient, conflictingConditions] of Object.entries(OPPOSING_NUTRIENT_CONDITIONS)) {
    const active = conflictingConditions.filter((c) => allConditions.includes(c));
    if (active.length > 1) {
      hasConflictingConditions = true;
      conflictNote = `Conflicting ${nutrient} guidelines in this household (${active.join(" vs ")}). A dietitian can help reconcile these.`;
      break;
    }
  }

  const allDislikes = [...new Set(all.flatMap((m) => m.dislikes ?? []))].slice(0, 15);
  const allRestrictions = [...new Set(all.flatMap((m) => m.restrictions ?? []))];
  const allCuisines = [...new Set(all.flatMap((m) => (m as any).cuisinePreferences ?? []))].slice(0, 20);

  // Per-member diet detection
  const proteinByMember: Record<string, number> = {};
  let hasVegan = false, hasVegetarian = false, hasMeatEater = false;
  for (const m of all) {
    const r = (m.restrictions ?? []).map((x) => x.toLowerCase());
    const isVegan = r.includes("vegan");
    const isVeg = isVegan || r.includes("vegetarian");
    if (isVegan) hasVegan = true;
    if (isVeg) hasVegetarian = true;
    if (!isVeg) hasMeatEater = true;
    if (m.name) proteinByMember[m.name] = (m as any).dailyTargets?.protein ?? 0;
  }
  const dietProfile: DietProfile = {
    hasVegan,
    hasVegetarian,
    hasMeatEater,
    mixed: hasMeatEater && hasVegetarian,
    proteinByMember,
  };

  return {
    restrictions: allRestrictions,
    conditions: allConditions,
    allergies: [...new Set(all.flatMap((m) => m.allergies ?? []))],
    dislikes: allDislikes,
    cuisinePreferences: allCuisines,
    memberNames: all.map((m) => m.name).filter((n): n is string => Boolean(n)),
    hasConflictingConditions,
    conflictNote,
    dietProfile,
  };
}

function computeMergedRestrictions(): MergedFamilyRestrictions {
  const members = getFamilyMembers();
  let self: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("userProfile");
    if (raw) self = JSON.parse(raw);
  } catch {}
  return computeMergedRestrictionsFromMembers(self, members);
}

export function regenerateMergedRestrictions(): MergedFamilyRestrictions {
  const merged = computeMergedRestrictions();
  localStorage.setItem(userScopedKey(FAMILY_MERGED_KEY), JSON.stringify(merged));
  return merged;
}

export function buildFamilyPromptBlock(merged: MergedFamilyRestrictions): string {
  return `\n FAMILY / HOUSEHOLD MODE 
Cooking for: ${merged.memberNames.join(", ") || "household"}
Combined dietary restrictions: ${merged.restrictions.join(", ") || "None"}
Combined allergies (NEVER include): ${merged.allergies.join(", ") || "None"}
Combined health conditions: ${merged.conditions.join(", ") || "None"}
${merged.hasConflictingConditions ? ` Note: ${merged.conflictNote}  do your best to suggest a balanced option.` : ""}`;
}

// TODO(family-sync): Migrate getFamilyMembers() / saveFamilyMembers() to Supabase `family_members` table.
// Schema: family_members(id uuid PK, household_id uuid FKhouseholds.id,
//   name text, age int, sex text, profile_json jsonb, created_at timestamptz)
// Households: households(id uuid PK, owner_id uuid FKauth.users.id, created_at)
// Invite: household_invites(id uuid, household_id uuid, token text UNIQUE, expires_at timestamptz)
// Real-time sync: Supabase Realtime channel `household:{household_id}` for shopping list + plan sync.
// Meal plans: meal_plans(id uuid, user_id uuid, week_start date, plan_json jsonb).
