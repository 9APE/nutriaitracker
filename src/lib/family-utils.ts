export interface FamilyMember {
  id: string;
  name: string;
  age?: number;
  sex?: string;
  restrictions: string[];
  conditions: string[];
  allergies: string[];
  dislikes: string[];
}

export interface MergedFamilyRestrictions {
  restrictions: string[];
  conditions: string[];
  allergies: string[];
  dislikes: string[];
  memberNames: string[];
  hasConflictingConditions: boolean;
  conflictNote?: string;
}

const FAMILY_PROFILES_KEY = "nutriai:familyProfiles";
const FAMILY_MODE_KEY = "nutriai:familyMode";

// Conditions that require opposite directions on the same nutrient.
// Used to surface a conflict warning when both conditions exist in the household.
const OPPOSING_NUTRIENT_CONDITIONS: Record<string, string[]> = {
  potassium: ["Kidney Disease", "Hypertension"],
  protein: ["Kidney Disease", "Obesity"],
};

export function getFamilyMembers(): FamilyMember[] {
  try {
    const raw = localStorage.getItem(FAMILY_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as FamilyMember[]) : [];
  } catch {
    return [];
  }
}

export function saveFamilyMembers(members: FamilyMember[]) {
  // Hard cap: 10 household members to prevent over-restriction of suggestions.
  const capped = members.slice(0, 10);
  localStorage.setItem(FAMILY_PROFILES_KEY, JSON.stringify(capped));
}

export function getHouseholdSize(): number {
  return getFamilyMembers().length + 1; // +1 for account owner
}

export function isFamilyMode(): boolean {
  return localStorage.getItem(FAMILY_MODE_KEY) === "true";
}

export function setFamilyMode(enabled: boolean) {
  localStorage.setItem(FAMILY_MODE_KEY, enabled ? "true" : "false");
}

export function getMergedFamilyRestrictions(): MergedFamilyRestrictions {
  const members = getFamilyMembers();
  let self: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("userProfile");
    if (raw) self = JSON.parse(raw);
  } catch {}

  const all: Array<Partial<FamilyMember>> = [self, ...members];
  const allConditions = [...new Set(all.flatMap((m) => m.conditions ?? []))];

  // Detect conflicting nutrient guidelines within the household
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

  // Cap dislikes at 15 to prevent over-restriction of suggestions
  const allDislikes = [...new Set(all.flatMap((m) => m.dislikes ?? []))].slice(0, 15);

  return {
    restrictions: [...new Set(all.flatMap((m) => m.restrictions ?? []))],
    conditions: allConditions,
    allergies: [...new Set(all.flatMap((m) => m.allergies ?? []))],
    dislikes: allDislikes,
    memberNames: all.map((m) => m.name).filter((n): n is string => Boolean(n)),
    hasConflictingConditions,
    conflictNote,
  };
}

export function buildFamilyPromptBlock(merged: MergedFamilyRestrictions): string {
  return `\n━━ FAMILY / HOUSEHOLD MODE ━━
Cooking for: ${merged.memberNames.join(", ") || "household"}
Combined dietary restrictions: ${merged.restrictions.join(", ") || "None"}
Combined allergies (NEVER include): ${merged.allergies.join(", ") || "None"}
Combined health conditions: ${merged.conditions.join(", ") || "None"}
${merged.hasConflictingConditions ? `⚠ Note: ${merged.conflictNote} — do your best to suggest a balanced option.` : ""}`;
}

// TODO(family-sync): Migrate getFamilyMembers() / saveFamilyMembers() to Supabase `family_members` table.
// Schema: family_members(id uuid PK, household_id uuid FK→households.id,
//   name text, age int, sex text, profile_json jsonb, created_at timestamptz)
// Households: households(id uuid PK, owner_id uuid FK→auth.users.id, created_at)
// Invite: household_invites(id uuid, household_id uuid, token text UNIQUE, expires_at timestamptz)
// Real-time sync: Supabase Realtime channel `household:{household_id}` for shopping list + plan sync.
// Meal plans: meal_plans(id uuid, user_id uuid, week_start date, plan_json jsonb).
