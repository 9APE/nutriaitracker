import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getHouseholdSize,
  setHouseholdSize,
  saveFamilyMembers,
  type FamilyMember,
} from "@/lib/family-utils";
import { FamilyMemberCard } from "@/components/nouri/FamilyMemberCard";
import { FamilyMemberOnboarding } from "@/components/nouri/FamilyMemberOnboarding";
import { FamilyRestrictionsSummary } from "@/components/nouri/FamilyRestrictionsSummary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function FamilySection() {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [householdSz, setHouseholdSz] = useState(() => getHouseholdSize());

  // Load from Supabase + cache to localStorage so the rest of the app
  // (meal planner, grocery list, restrictions summary) stays in sync.
  const load = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load family", error);
      toast.error("Couldn't load family members");
      setLoading(false);
      return;
    }
    const list: FamilyMember[] = (data ?? []).map((row: any) => ({
      ...(row.profile ?? {}),
      id: row.member_id,
      name: row.name ?? (row.profile?.name ?? "Family member"),
    } as FamilyMember));
    setMembers(list);
    saveFamilyMembers(list); // refresh local cache + merged restrictions
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddDone = async (member: FamilyMember) => {
    if (!user) return;
    const { error } = await supabase.from("family_members").insert({
      user_id: user.id,
      member_id: member.id,
      name: member.name,
      profile: member as any,
    });
    if (error) {
      toast.error(error.message || "Couldn't save family member");
      return;
    }
    setShowOnboarding(false);
    toast.success(`${member.name} added to your family`);
    await load();
  };

  const handleEditDone = async (member: FamilyMember) => {
    if (!user) return;
    const { error } = await supabase
      .from("family_members")
      .update({ name: member.name, profile: member as any })
      .eq("user_id", user.id)
      .eq("member_id", member.id);
    if (error) {
      toast.error(error.message || "Couldn't update family member");
      return;
    }
    setEditingMember(null);
    toast.success(`${member.name}'s profile updated`);
    await load();
  };

  const handleDelete = async (member: FamilyMember) => {
    if (!user) return;
    if (!confirm(`Remove ${member.name} from your family?`)) return;
    const { error } = await supabase
      .from("family_members")
      .delete()
      .eq("user_id", user.id)
      .eq("member_id", member.id);
    if (error) {
      toast.error(error.message || "Couldn't remove family member");
      return;
    }
    toast(`${member.name} removed`);
    await load();
  };

  const handleHouseholdChange = (size: number) => {
    setHouseholdSz(size);
    setHouseholdSize(size);
  };

  if (showOnboarding) {
    return (
      <FamilyMemberOnboarding
        onDone={handleAddDone}
        onClose={() => setShowOnboarding(false)}
      />
    );
  }

  if (editingMember) {
    return (
      <FamilyMemberOnboarding
        existingMember={editingMember}
        onDone={handleEditDone}
        onClose={() => setEditingMember(null)}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Users size={16} className="text-primary" />
        <h3 className="text-sm font-medium">My Family</h3>
      </div>

      {/* Household size */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Household size</span>
          <select
            value={householdSz}
            onChange={(e) => handleHouseholdChange(parseInt(e.target.value))}
            className="bg-background border border-border rounded-lg px-2 py-1 text-xs"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        members.length > 0 && (
          <div className="space-y-2">
            {members.map((m) => (
              <FamilyMemberCard
                key={m.id}
                member={m}
                onEdit={() => setEditingMember(m)}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </div>
        )
      )}

      {/* Add member button */}
      <button
        onClick={() => setShowOnboarding(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border hover:border-primary/40 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus size={16} />
        Add family member
      </button>

      {/* Merged restrictions summary */}
      <FamilyRestrictionsSummary />
    </section>
  );
}
