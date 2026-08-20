"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/form-engine-types";

export function DateInput({ fieldDef }: { fieldDef: FieldDef }) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={fieldDef.field}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1.5 w-full">
          <Label htmlFor={fieldDef.field}>
            {fieldDef.label}{" "}
            {fieldDef.required && (
              <span className="text-destructive">*</span>
            )}
          </Label>
          <input
            id={fieldDef.field}
            type="date"
            {...field}
            value={field.value ?? ""}
            className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {fieldDef.help && (
            <span className="text-[10px] text-muted-foreground">
              {fieldDef.help}
            </span>
          )}
          {fieldState.error && (
            <span className="text-xs text-destructive">
              {fieldState.error.message}
            </span>
          )}
        </div>
      )}
    />
  );
}
