import { supabase } from "@/integrations/supabase/client";
import {
  computeMergedRestrictionsFromMembers,
  getFamilyMembers,
  getHouseholdSize,
  isFamilyMode,
  type FamilyMember,
  type MergedFamilyRestrictions,
} from "@/lib/family-utils";

export interface FamilyContext {
  familyMode: boolean;
  householdSize: number;
  memberProfiles: FamilyMember[];
  mergedRestrictions: MergedFamilyRestrictions;
}

function normalizeFamilyMember(value: any): FamilyMember | null {
  const profile = value?.profile && typeof value.profile === "object" ? value.profile : {};
  const name = typeof value?.name === "string" && value.name.trim()
    ? value.name.trim()
    : typeof profile.name === "string" && profile.name.trim()
      ? profile.name.trim()
      : "";
  if (!name) return null;

  return {
    id: String(value?.member_id ?? value?.id ?? profile.id ?? crypto.randomUUID()),
    name,
    age: typeof profile.age === "number" ? profile.age : undefined,
    sex: typeof profile.sex === "string" ? profile.sex : undefined,
    height: typeof profile.height === "string" ? profile.height : undefined,
    weight: typeof profile.weight === "string" ? profile.weight : undefined,
    restrictions: Array.isArray(profile.restrictions) ? profile.restrictions.map(String) : [],
    conditions: Array.isArray(profile.conditions) ? profile.conditions.map(String) : [],
    allergies: Array.isArray(profile.allergies) ? profile.allergies.map(String) : [],
    dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.map(String) : [],
    activityLevel: typeof profile.activityLevel === "string" ? profile.activityLevel : undefined,
    goals: typeof profile.goals === "string" ? profile.goals : undefined,
    cuisinePreferences: Array.isArray(profile.cuisinePreferences) ? profile.cuisinePreferences.map(String) : [],
    dailyTargets: profile.dailyTargets && typeof profile.dailyTargets === "object"
      ? {
          calories: Number(profile.dailyTargets.calories) || 0,
          protein: Number(profile.dailyTargets.protein) || 0,
          carbs: Number(profile.dailyTargets.carbs) || 0,
          fat: Number(profile.dailyTargets.fat) || 0,
        }
      : undefined,
  };
}

export async function getFamilyContext(
  selfProfile: Record<string, any> | null | undefined,
  userId?: string | null,
): Promise<FamilyContext> {
  let memberProfiles: FamilyMember[] = [];

  if (userId) {
    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, member_id, name, profile")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      memberProfiles = (data ?? [])
        .map(normalizeFamilyMember)
        .filter((member): member is FamilyMember => Boolean(member));
    } catch {
      memberProfiles = [];
    }
  }

  if (memberProfiles.length === 0) {
    memberProfiles = getFamilyMembers();
  }

  const mergedRestrictions = computeMergedRestrictionsFromMembers(
    selfProfile ?? {},
    memberProfiles,
  );

  return {
    familyMode: isFamilyMode() || memberProfiles.length > 0,
    householdSize: Math.max(getHouseholdSize(), memberProfiles.length + 1),
    memberProfiles,
    mergedRestrictions,
  };
}
