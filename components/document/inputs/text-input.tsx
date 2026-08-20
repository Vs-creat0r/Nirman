"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/form-engine-types";

export function TextInput({ fieldDef }: { fieldDef: FieldDef }) {
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
          <Input
            id={fieldDef.field}
            type="text"
            placeholder={`Enter ${fieldDef.label.toLowerCase()}…`}
            maxLength={fieldDef.validation?.maxLength}
            disabled={fieldDef.input === "readonly"}
            {...field}
            value={field.value || ""}
            className="h-9 text-sm"
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
