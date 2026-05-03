import { Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMergedFamilyRestrictions, getHouseholdSize } from "@/lib/family-utils";

export function FamilyRestrictionsSummary() {
  const merged = getMergedFamilyRestrictions();
  const size = getHouseholdSize();

  const allBadges = [
    ...merged.restrictions.map((r) => ({ label: r, color: "green" as const })),
    ...merged.allergies.map((a) => ({ label: `No ${a}`, color: "red" as const })),
    ...merged.conditions.map((c) => ({ label: c, color: "blue" as const })),
  ];

  if (size <= 1 && !allBadges.length) return null;

  return (
    <div className="nouri-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={15} className="text-primary shrink-0" />
        <span className="text-sm font-medium">
          Household Rules
          <span className="text-muted-foreground font-normal ml-1">({size} {size === 1 ? "person" : "people"})</span>
        </span>
      </div>

      {merged.hasConflictingConditions && merged.conflictNote && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>{merged.conflictNote}</span>
        </div>
      )}

      {allBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {allBadges.map((b, i) => (
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
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No combined restrictions yet.</p>
      )}

      <p className="text-[10px] text-muted-foreground">
        All AI recommendations apply these rules when Family mode is active.
      </p>
    </div>
  );
}
