import { useState } from "react";
import { cn } from "@/lib/utils";
import { isFamilyMode, setFamilyMode, getHouseholdSize } from "@/lib/family-utils";
import { Users, User } from "lucide-react";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}

export function FamilyModeToggle({ value, onChange, className }: Props) {
  const size = getHouseholdSize();
  if (size <= 1) return null;

  return (
    <div className={cn("flex items-center gap-1 bg-muted rounded-full p-0.5", className)}>
      <button
        onClick={() => onChange(false)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
          !value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={!value}
      >
        <User size={11} />
        Me
      </button>
      <button
        onClick={() => onChange(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
          value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={value}
      >
        <Users size={11} />
        Family
      </button>
    </div>
  );
}

export function useFamilyMode(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => isFamilyMode());
  const toggle = (v: boolean) => {
    setFamilyMode(v);
    setValue(v);
  };
  return [value, toggle];
}
