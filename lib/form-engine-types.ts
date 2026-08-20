/**
 * Contract schema types — describes the JSON structure that drives
 * the Universal Document Form Engine.
 *
 * Every document type (MR, CC, PO, DC, GRN) has a contract JSON.
 * The form engine reads the contract and renders the correct fields.
 */

export type FieldInputType =
  | "text"
  | "number"
  | "select"
  | "date"
  | "textarea"
  | "readonly-badge"
  | "readonly"
  | "item-list"
  | "hidden"
  | "autocomplete";

export type FieldType =
  | "string"
  | "number"
  | "enum"
  | "date"
  | "text"
  | "reference"
  | "array"
  | "object";

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
}

export interface FieldRelation {
  table: string;
}

export interface FieldDef {
  field: string;
  label: string;
  type: FieldType;
  input: FieldInputType;
  required: boolean;
  validation?: FieldValidation;
  relation?: FieldRelation;
  optionsFrom?: string;
  default?: string | number | boolean;
  help?: string;
  /** For array / item-list fields */
  items?: {
    type: string;
    fields: FieldDef[];
  };
}

export interface DocumentContract {
  $schema: string;
  name: string;
  label: string;
  version: string;
  description: string;
  fields: FieldDef[];
  statuses: string[];
  relations?: Record<string, string>;
  indexes?: string[][];
  audit?: {
    enabled: boolean;
    trackCreatedBy?: boolean;
    trackUpdatedBy?: boolean;
    trackUpdatedAt?: boolean;
  };
}

/** Options passed to fields that need to resolve references (projects, sites, etc.) */
export interface FieldOption {
  value: string;
  label: string;
}

/** Map from optionsFrom key → array of options, provided by the parent page */
export type OptionsMap = Record<string, FieldOption[]>;
