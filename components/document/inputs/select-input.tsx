"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import type { FieldDef, FieldOption } from "@/lib/form-engine-types";

interface SelectInputProps {
  fieldDef: FieldDef;
  options?: FieldOption[];
}

export function SelectInput({ fieldDef, options }: SelectInputProps) {
  const { control } = useFormContext();

  // Options come from either validation.enum or the passed-in options prop
  const selectOptions: FieldOption[] =
    options ??
    fieldDef.validation?.enum?.map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " "),
    })) ??
    [];

  const hasNoOptions = selectOptions.length === 0 && !fieldDef.required;

  return (
    <Controller
      control={control}
      name={fieldDef.field}
      render={({ field, fieldState }) => {
        const isSiteField = fieldDef.field === "siteId";
        const placeholderText = hasNoOptions
          ? isSiteField
            ? "No sub-sites (Project is single site)"
            : `No ${fieldDef.label.toLowerCase()} available`
          : `Select ${fieldDef.label.toLowerCase()}${fieldDef.required ? "…" : " (optional)…"}`;

        return (
          <div
            className={
              hasNoOptions
                ? "flex flex-col gap-1.5 w-full opacity-60 transition-opacity"
                : "flex flex-col gap-1.5 w-full transition-opacity"
            }
          >
            <Label htmlFor={fieldDef.field}>
              {fieldDef.label}{" "}
              {fieldDef.required && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <div className="relative">
              <select
                id={fieldDef.field}
                {...field}
                disabled={hasNoOptions || fieldDef.input === "readonly"}
                value={field.value ?? fieldDef.default ?? ""}
                className="flex h-9 w-full appearance-none rounded-md border border-border bg-input px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground"
              >
                <option value="">
                  {placeholderText}
                </option>
                {selectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Custom chevron */}
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {hasNoOptions && isSiteField ? (
              <span className="text-[10px] text-muted-foreground italic">
                Project itself acts as the primary site.
              </span>
            ) : fieldDef.help ? (
              <span className="text-[10px] text-muted-foreground">
                {fieldDef.help}
              </span>
            ) : null}
            {fieldState.error && (
              <span className="text-xs text-destructive">
                {fieldState.error.message}
              </span>
            )}
          </div>
        );
      }}
    />
  );
}
