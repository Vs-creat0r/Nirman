"use client";

import type { FieldDef, FieldOption, OptionsMap } from "@/lib/form-engine-types";
import { TextInput } from "./inputs/text-input";
import { NumberInput } from "./inputs/number-input";
import { SelectInput } from "./inputs/select-input";
import { DateInput } from "./inputs/date-input";
import { TextareaInput } from "./inputs/textarea-input";
import { ReadonlyBadge } from "./inputs/readonly-badge";
import { ReadonlyField } from "./inputs/readonly-field";
import { ItemListInput } from "./inputs/item-list-input";

interface FieldRendererProps {
  fieldDef: FieldDef;
  /** Lookup map: optionsFrom key → FieldOption[] */
  optionsMap?: OptionsMap;
  /** Render function for custom input types like item-list */
  renderItemList?: (fieldDef: FieldDef) => React.ReactNode;
}

/**
 * FieldRenderer — the routing heart of the form engine.
 *
 * Reads `fieldDef.input` and renders the corresponding control.
 * Zero hardcoded field names — purely contract-driven.
 */
export function FieldRenderer({
  fieldDef,
  optionsMap,
  renderItemList,
}: FieldRendererProps) {
  // Skip hidden fields entirely
  if (fieldDef.input === "hidden") {
    return null;
  }

  // Resolve options for select / reference fields
  const resolvedOptions: FieldOption[] | undefined =
    fieldDef.optionsFrom && optionsMap?.[fieldDef.optionsFrom]
      ? optionsMap[fieldDef.optionsFrom]
      : undefined;

  switch (fieldDef.input) {
    case "text":
      return <TextInput fieldDef={fieldDef} />;

    case "number":
      return <NumberInput fieldDef={fieldDef} />;

    case "select":
      return <SelectInput fieldDef={fieldDef} options={resolvedOptions} />;

    case "date":
      return <DateInput fieldDef={fieldDef} />;

    case "textarea":
      return <TextareaInput fieldDef={fieldDef} />;

    case "readonly-badge":
      return <ReadonlyBadge fieldDef={fieldDef} />;

    case "readonly":
      return <ReadonlyField fieldDef={fieldDef} />;

    case "item-list":
      if (renderItemList) {
        return <>{renderItemList(fieldDef)}</>;
      }
      return <ItemListInput fieldDef={fieldDef} optionsMap={optionsMap} />;

    case "autocomplete":
      // Fallback to text input
      return <TextInput fieldDef={fieldDef} />;

    default:
      // Unknown input type — render a read-only fallback
      console.warn(
        `[FieldRenderer] Unknown input type "${fieldDef.input}" for field "${fieldDef.field}"`
      );
      return <ReadonlyField fieldDef={fieldDef} />;
  }
}
