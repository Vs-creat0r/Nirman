"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/form-engine-types";

export function TextareaInput({ fieldDef }: { fieldDef: FieldDef }) {
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
          <textarea
            id={fieldDef.field}
            {...field}
            value={field.value ?? ""}
            maxLength={fieldDef.validation?.maxLength}
            rows={3}
            placeholder={`Enter ${fieldDef.label.toLowerCase()}…`}
            className="flex min-h-[72px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            {fieldDef.help && (
              <span className="text-[10px] text-muted-foreground">
                {fieldDef.help}
              </span>
            )}
            {fieldDef.validation?.maxLength && (
              <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                {(field.value?.length ?? 0)}/{fieldDef.validation.maxLength}
              </span>
            )}
          </div>
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
