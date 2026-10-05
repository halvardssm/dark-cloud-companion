import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  badges?: ReactNode;
  detail?: ReactNode;
}

/** A single big-tap-target checklist row. */
export function CheckRow({ checked, onChange, label, badges, detail }: Props) {
  return (
    <label className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
            checked && "text-muted-foreground line-through",
          )}
        >
          {label}
          {badges}
        </span>
        {detail ? <span className="text-muted-foreground text-xs">{detail}</span> : null}
      </span>
    </label>
  );
}
