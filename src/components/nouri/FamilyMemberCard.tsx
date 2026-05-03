import { Trash2, Edit2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FamilyMember } from "@/lib/family-utils";

interface Props {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}

export function FamilyMemberCard({ member, onEdit, onDelete }: Props) {
  const badges = [
    ...member.restrictions.map((r) => ({ label: r, color: "green" as const })),
    ...member.allergies.map((a) => ({ label: `No ${a}`, color: "red" as const })),
    ...member.conditions.map((c) => ({ label: c, color: "blue" as const })),
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User size={14} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium">{member.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {member.age ? `${member.age} yrs` : ""}
              {member.sex ? ` · ${member.sex}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Edit ${member.name}`}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label={`Remove ${member.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {member.dailyTargets && (
        <div className="text-[10px] text-muted-foreground">
          {member.dailyTargets.calories} kcal · {member.dailyTargets.protein}g P · {member.dailyTargets.carbs}g C · {member.dailyTargets.fat}g F
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.slice(0, 6).map((b, i) => (
            <Badge
              key={i}
              variant="outline"
              className={
                b.color === "green"
                  ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]"
                  : b.color === "red"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[10px]"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]"
              }
            >
              {b.label}
            </Badge>
          ))}
          {badges.length > 6 && (
            <Badge variant="outline" className="text-[10px]">+{badges.length - 6}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
