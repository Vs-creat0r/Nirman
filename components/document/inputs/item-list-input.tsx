"use client";

import * as React from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldDef, FieldOption, OptionsMap } from "@/lib/form-engine-types";

interface ItemListInputProps {
  fieldDef: FieldDef;
  optionsMap?: OptionsMap;
}

export function ItemListInput({ fieldDef, optionsMap }: ItemListInputProps) {
  const { control, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldDef.field,
  });

  const subFields = fieldDef.items?.fields || [];
  const visibleSubFields = subFields.filter((f) => f.input !== "hidden");

  // If no rows exist, initialize with one empty row
  React.useEffect(() => {
    if (fields.length === 0) {
      const initialRow: Record<string, unknown> = {};
      for (const sf of subFields) {
        if (sf.default !== undefined) {
          initialRow[sf.field] = sf.default;
        } else if (sf.field === "unit") {
          initialRow[sf.field] = "bags";
        } else if (sf.field === "quantity") {
          initialRow[sf.field] = 1;
        } else {
          initialRow[sf.field] = "";
        }
      }
      append(initialRow);
    }
  }, [fields.length, append, subFields]);

  const handleAddRow = () => {
    const newRow: Record<string, unknown> = {};
    for (const sf of subFields) {
      if (sf.default !== undefined) {
        newRow[sf.field] = sf.default;
      } else if (sf.field === "unit") {
        newRow[sf.field] = "bags";
      } else if (sf.field === "quantity") {
        newRow[sf.field] = 1;
      } else {
        newRow[sf.field] = "";
      }
    }
    append(newRow);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">
          {fieldDef.label}{" "}
          {fieldDef.required && <span className="text-destructive">*</span>}
        </Label>
        <span className="text-[11px] text-muted-foreground">
          {fields.length} {fields.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Responsive Table / Card List */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                <th className="py-2 px-3 w-10 text-center">#</th>
                {visibleSubFields.map((sf) => (
                  <th
                    key={sf.field}
                    className={`py-2 px-3 ${
                      sf.field === "quantity"
                        ? "w-24 text-right"
                        : sf.field === "unit"
                        ? "w-28"
                        : sf.field === "description"
                        ? "min-w-[180px]"
                        : "min-w-[160px]"
                    }`}
                  >
                    {sf.label}{" "}
                    {sf.required && (
                      <span className="text-destructive font-bold">*</span>
                    )}
                  </th>
                ))}
                <th className="py-2 px-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((fieldItem, index) => (
                <tr
                  key={fieldItem.id}
                  className="hover:bg-muted/20 transition-colors group"
                >
                  <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[11px]">
                    {index + 1}
                  </td>

                  {visibleSubFields.map((sf) => {
                    const inputName = `${fieldDef.field}.${index}.${sf.field}`;

                    return (
                      <td key={sf.field} className="py-2 px-2 align-top">
                        <Controller
                          control={control}
                          name={inputName}
                          rules={{
                            required: sf.required ? `${sf.label} is required` : false,
                          }}
                          render={({ field, fieldState }) => {
                            if (sf.input === "select") {
                              const options: FieldOption[] =
                                sf.validation?.enum?.map((v) => ({
                                  value: v,
                                  label: v,
                                })) ??
                                (sf.optionsFrom && optionsMap?.[sf.optionsFrom]
                                  ? optionsMap[sf.optionsFrom]
                                  : []);

                              return (
                                <div>
                                  <select
                                    {...field}
                                    value={field.value ?? sf.default ?? ""}
                                    className="flex h-8 w-full rounded-md border border-border bg-input px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  >
                                    {options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {fieldState.error && (
                                    <span className="text-[10px] text-destructive block mt-0.5">
                                      {fieldState.error.message}
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            if (sf.input === "number") {
                              return (
                                <div>
                                  <Input
                                    type="number"
                                    min={sf.validation?.min ?? 0}
                                    step="any"
                                    placeholder="0"
                                    className="h-8 text-xs text-right font-mono"
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === "") {
                                        field.onChange("");
                                      } else {
                                        const val = Number(raw);
                                        field.onChange(isNaN(val) ? 0 : Math.max(0, val));
                                      }
                                    }}
                                  />
                                  {fieldState.error && (
                                    <span className="text-[10px] text-destructive block mt-0.5">
                                      {fieldState.error.message}
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div>
                                <Input
                                  type="text"
                                  placeholder={
                                    sf.field === "description"
                                      ? "Specification / note…"
                                      : `Enter ${sf.label.toLowerCase()}…`
                                  }
                                  maxLength={sf.validation?.maxLength}
                                  className="h-8 text-xs"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                                {fieldState.error && (
                                  <span className="text-[10px] text-destructive block mt-0.5">
                                    {fieldState.error.message}
                                  </span>
                                )}
                              </div>
                            );
                          }}
                        />
                      </td>
                    );
                  })}

                  <td className="py-2 px-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors cursor-pointer"
                      title={fields.length <= 1 ? "At least 1 item is required" : "Remove item"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add item row action */}
        <div className="p-2 border-t border-border bg-muted/20 flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="h-7 text-xs gap-1.5 text-foreground hover:bg-surface"
          >
            <Plus className="h-3 w-3" />
            Add Item
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Minimum 1 item required
          </span>
        </div>
      </div>
    </div>
  );
}
