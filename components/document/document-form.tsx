"use client";

import { useForm, FormProvider } from "react-hook-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldRenderer } from "./field-renderer";
import type {
  DocumentContract,
  FieldDef,
  OptionsMap,
} from "@/lib/form-engine-types";

interface DocumentFormProps {
  /** The contract JSON that drives which fields render */
  contract: DocumentContract;
  /** Pre-filled values (for edit / resubmit flows) */
  defaultValues?: Record<string, unknown>;
  /** Lookup tables for reference fields (projects, sites, etc.) */
  optionsMap?: OptionsMap;
  /** Called with validated form data on submit */
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
  /** Whether the form is in a submitting state */
  isSubmitting?: boolean;
  /** Submit button label — defaults to "Submit" */
  submitLabel?: string;
  /** If true, the form is readonly (detail view) */
  readonly?: boolean;
  /** Render function for item-list fields */
  renderItemList?: (fieldDef: FieldDef) => React.ReactNode;
  /** Extra actions to render in the form footer (e.g. Approve/Reject) */
  footerActions?: React.ReactNode;
}

/**
 * DocumentForm — the Universal Document Form Engine.
 *
 * Accepts a contract JSON and renders the correct form fields.
 * No hardcoded field names — purely contract-driven.
 *
 * Usage:
 * ```tsx
 * import materialRequestContract from "@/contracts/material_request.json";
 *
 * <DocumentForm
 *   contract={materialRequestContract}
 *   optionsMap={{ projects: [...], sites: [...] }}
 *   onSubmit={handleSubmit}
 * />
 * ```
 */
export function DocumentForm({
  contract,
  defaultValues,
  optionsMap,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Submit",
  readonly = false,
  renderItemList,
  footerActions,
}: DocumentFormProps) {
  // Build default values from the contract's `default` properties
  const contractDefaults = buildDefaults(contract.fields);
  const mergedDefaults = { ...contractDefaults, ...defaultValues };

  const methods = useForm({
    defaultValues: mergedDefaults,
    mode: "onBlur",
  });

  const handleFormSubmit = methods.handleSubmit(async (data) => {
    if (onSubmit) {
      await onSubmit(data);
    }
  });

  // Separate fields into layout groups:
  // 1. Header fields (readonly-badge: refNo, status) — shown in the card header
  // 2. Editable fields — the main form body
  // 3. Readonly fields — shown at the bottom
  const headerFields = contract.fields.filter(
    (f) => f.input === "readonly-badge"
  );
  const editableFields = contract.fields.filter(
    (f) =>
      f.input !== "readonly-badge" &&
      f.input !== "readonly" &&
      f.input !== "hidden"
  );
  const readonlyFields = contract.fields.filter(
    (f) => f.input === "readonly"
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleFormSubmit}>
        <Card>
          {/* ── Card Header: Document title + status badges ── */}
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {contract.label}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {contract.description}
                </CardDescription>
              </div>
              {/* Header badges (refNo, status) */}
              {headerFields.length > 0 && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  {headerFields.map((f) => (
                    <FieldRenderer
                      key={f.field}
                      fieldDef={f}
                      optionsMap={optionsMap}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardHeader>

          {/* ── Card Body: Editable form fields ── */}
          <CardContent className="space-y-5">
            {/* Grid layout — responsive 1→2 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {editableFields.map((f) => {
                // Item-list fields get full width
                const isFullWidth =
                  f.input === "item-list" || f.input === "textarea";
                return (
                  <div
                    key={f.field}
                    className={isFullWidth ? "col-span-full" : ""}
                  >
                    <FieldRenderer
                      fieldDef={f}
                      optionsMap={optionsMap}
                      renderItemList={renderItemList}
                    />
                  </div>
                );
              })}
            </div>

            {/* Readonly fields (reviewedBy, reviewedAt, etc.) */}
            {readonlyFields.length > 0 && (
              <>
                <div className="border-t border-border" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {readonlyFields.map((f) => (
                    <FieldRenderer
                      key={f.field}
                      fieldDef={f}
                      optionsMap={optionsMap}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Footer: Submit + extra actions ── */}
            {!readonly && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                {footerActions}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving…
                    </span>
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </FormProvider>
  );
}

/**
 * Builds a default values object from contract field definitions.
 * Only includes fields that have an explicit `default` property.
 */
function buildDefaults(fields: FieldDef[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined) {
      defaults[f.field] = f.default;
    }
  }
  return defaults;
}
