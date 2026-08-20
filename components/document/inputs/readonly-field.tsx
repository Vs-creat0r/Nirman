"use client";

import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/form-engine-types";

export function ReadonlyField({ fieldDef }: { fieldDef: FieldDef }) {
  const { watch } = useFormContext();
  const value = watch(fieldDef.field);

  function formatValue(val: unknown): string {
    if (val == null || val === "") return "—";
    // Attempt ISO date formatting
    if (fieldDef.type === "date" && typeof val === "string") {
      try {
        return new Date(val).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <Label>{fieldDef.label}</Label>
      <div className="flex items-center h-9 px-3 text-sm text-muted-foreground bg-muted rounded-md border border-border">
        {formatValue(value)}
      </div>
      {fieldDef.help && (
        <span className="text-[10px] text-muted-foreground">
          {fieldDef.help}
        </span>
      )}
    </div>
  );
}
