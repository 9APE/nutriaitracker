import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  getHouseholdSize,
  setHouseholdSize,
  type FamilyMember,
} from "@/lib/family-utils";
import { FamilyMemberCard } from "@/components/nouri/FamilyMemberCard";
import { FamilyMemberOnboarding } from "@/components/nouri/FamilyMemberOnboarding";
import { FamilyRestrictionsSummary } from "@/components/nouri/FamilyRestrictionsSummary";

export function FamilySection() {
  const [members, setMembers] = useState<FamilyMember[]>(() => getFamilyMembers());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [householdSz, setHouseholdSz] = useState(() => getHouseholdSize());

  const refresh = () => setMembers(getFamilyMembers());

  const handleAddDone = (member: FamilyMember) => {
    addFamilyMember(member);
    refresh();
    setShowOnboarding(false);
    toast.success(`${member.name} added to your family`);
  };

  const handleEditDone = (member: FamilyMember) => {
    updateFamilyMember(member.id, member);
    refresh();
    setEditingMember(null);
    toast.success(`${member.name}'s profile updated`);
  };

  const handleDelete = (member: FamilyMember) => {
    if (!confirm(`Remove ${member.name} from your family?`)) return;
    removeFamilyMember(member.id);
    refresh();
    toast(`${member.name} removed`);
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

      {/* Family members */}
      {members.length > 0 && (
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
