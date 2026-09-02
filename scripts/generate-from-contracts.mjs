#!/usr/bin/env node
/**
 * Nirman — contract codegen
 * ------------------------------------------------------------------
 * Reads  contracts/*.json   (the single source of truth)
 * Emits  convex/schema.ts       — Convex tables, validators, indexes
 *        lib/schemas/<name>.ts  — Zod schema for the editable form fields
 *        lib/contract-types.ts  — shared status unions + role union
 *
 * Run:   node scripts/generate-from-contracts.mjs
 *        node scripts/generate-from-contracts.mjs --check   (CI: fail if stale)
 *
 * NEVER hand-edit the generated files. Change the contract, re-run this.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const CONTRACTS = join(ROOT, "contracts");
const CHECK = process.argv.includes("--check");
const BANNER = `// GENERATED FILE — do not edit.\n// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs\n`;

const READONLY_INPUTS = new Set(["readonly", "readonly-badge", "hidden"]);
const errors = [];
const warnings = [];

// ---------- load ----------
const files = readdirSync(CONTRACTS).filter((f) => f.endsWith(".json")).sort();
const contracts = files.map((f) => {
  try {
    return JSON.parse(readFileSync(join(CONTRACTS, f), "utf8"));
  } catch (e) {
    errors.push(`${f}: invalid JSON — ${e.message}`);
    return null;
  }
}).filter(Boolean);

const tableNames = new Set(contracts.map((c) => c.name));

// ---------- validate ----------
for (const c of contracts) {
  if (!c.name || !c.label || !Array.isArray(c.fields)) {
    errors.push(`${c.name ?? "(unnamed)"}: missing name, label or fields`);
    continue;
  }
  const seen = new Set();
  for (const f of c.fields) {
    if (!f.field || !f.label || !f.type) errors.push(`${c.name}.${f.field ?? "?"}: needs field, label and type`);
    if (typeof f.required !== "boolean") errors.push(`${c.name}.${f.field}: 'required' must be explicit true/false`);
    if (seen.has(f.field)) errors.push(`${c.name}.${f.field}: duplicate field name`);
    seen.add(f.field);
    if (f.relation?.table && !tableNames.has(f.relation.table)) {
      errors.push(`${c.name}.${f.field}: relation.table "${f.relation.table}" is not a contract`);
    }
    if (f.type === "enum" && !f.validation?.enum) {
      errors.push(`${c.name}.${f.field}: type enum requires validation.enum`);
    }
    if ((f.input === "select" || f.input === "multi-select" || f.input === "autocomplete")
        && !f.optionsFrom && !f.validation?.enum && !f.relation?.table) {
      warnings.push(`${c.name}.${f.field}: ${f.input} has no optionsFrom, relation or enum`);
    }
  }
  for (const idx of c.indexes ?? []) {
    for (const col of idx) {
      if (col === "createdBy" || col === "createdAt") continue;
      if (!seen.has(col)) errors.push(`${c.name}: index column "${col}" is not a field`);
    }
  }
}
if (errors.length) {
  console.error("\n✖ Contract validation failed:\n" + errors.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}

// ---------- Convex validators ----------
function convexLeaf(f, indent) {
  const pad = "  ".repeat(indent);
  switch (f.type) {
    case "reference":
      return `v.id("${f.relation.table}")`;
    case "enum": {
      const lits = f.validation.enum.map((e) => `v.literal("${e}")`);
      return lits.length === 1 ? lits[0] : `v.union(${lits.join(", ")})`;
    }
    case "string":
    case "text":
    case "date":           // ISO-8601 strings — sort correctly in indexes
      return "v.string()";
    case "number":  return "v.number()";
    case "boolean": return "v.boolean()";
    case "file":    return `v.id("_storage")`;
    case "array": {
      if (f.items?.fields) return `v.array(\n${pad}  ${convexObject(f.items.fields, indent + 1)}\n${pad})`;
      if (f.relation?.table) return `v.array(v.id("${f.relation.table}"))`;
      if (f.items?.type === "file") return `v.array(v.id("_storage"))`;
      if (f.input === "file") return `v.array(v.id("_storage"))`;
      return "v.array(v.string())";
    }
    case "object":
      if (f.fields) return convexObject(f.fields, indent);
      warnings.push(`${f.field}: object without fields → v.any()`);
      return "v.any()";
    default:
      warnings.push(`${f.field}: unknown type "${f.type}" → v.any()`);
      return "v.any()";
  }
}
function convexField(f, indent) {
  const leaf = convexLeaf(f, indent);
  return f.required ? leaf : `v.optional(${leaf})`;
}
function convexObject(fields, indent) {
  const pad = "  ".repeat(indent);
  const body = fields.map((f) => `${pad}  ${f.field}: ${convexField(f, indent + 1)},`).join("\n");
  return `v.object({\n${body}\n${pad}})`;
}

const schemaBody = contracts.map((c) => {
  const lines = c.fields.map((f) => `    ${f.field}: ${convexField(f, 2)},`);
  if (c.audit?.enabled) {
    if (c.audit.trackCreatedBy) lines.push(c.name === "users" ? `    createdBy: v.optional(v.id("users")),` : `    createdBy: v.id("users"),`);
    if (c.audit.trackUpdatedBy) lines.push(`    updatedBy: v.optional(v.id("users")),`);
    if (c.audit.trackUpdatedAt) lines.push(`    updatedAt: v.optional(v.string()),`);
  }
  const idx = (c.indexes ?? []).map((cols) => {
    const name = "by_" + cols.join("_");
    return `\n    .index("${name}", [${cols.map((x) => `"${x}"`).join(", ")}])`;
  }).join("");
  return `  // ${c.label} — ${c.description}\n  ${c.name}: defineTable({\n${lines.join("\n")}\n  })${idx},`;
}).join("\n\n");

const schemaTs = `${BANNER}
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
${schemaBody}
});
`;

// ---------- Zod ----------
function zodLeaf(f) {
  const val = f.validation ?? {};
  const s = [];
  switch (f.type) {
    case "enum":
      return `z.enum([${val.enum.map((e) => `"${e}"`).join(", ")}])`;
    case "reference":
      return `z.string().min(1, "${f.label} is required")`;
    case "number":
      s.push("z.coerce.number()");
      if (val.min !== undefined) s.push(`.min(${val.min}, "${f.label} must be at least ${val.min}")`);
      if (val.max !== undefined) s.push(`.max(${val.max}, "${f.label} must be at most ${val.max}")`);
      return s.join("");
    case "boolean":
      return "z.boolean()";
    case "date":
      return `z.string().min(1, "${f.label} is required")`;
    case "file":
      return "z.string()";
    case "array": {
      const nested = (f.items?.fields ?? []).filter((sf) => !READONLY_INPUTS.has(sf.input));
      const inner = nested.length
        ? `z.object({\n${nested.map((sf) => `      ${sf.field}: ${zodField(sf)},`).join("\n")}\n    })`
        : "z.string()";
      let a = `z.array(${inner})`;
      if (val.minLength) a += `.min(${val.minLength}, "Add at least ${val.minLength} ${f.label.toLowerCase()}")`;
      return a;
    }
    default: // string | text
      if (val.enum) return `z.enum([${val.enum.map((e) => `"${e}"`).join(", ")}])`;
      s.push("z.string()");
      if (val.minLength) s.push(`.min(${val.minLength}, "${f.label} is required")`);
      if (val.maxLength) s.push(`.max(${val.maxLength}, "${f.label} is too long")`);
      if (val.pattern) s.push(`.regex(/${val.pattern}/, "${f.label} is not in the expected format")`);
      return s.join("");
  }
}
function zodField(f) {
  const leaf = zodLeaf(f);
  return f.required ? leaf : `${leaf}.optional()`;
}

const zodFiles = contracts.map((c) => {
  const editable = c.fields.filter((f) => !READONLY_INPUTS.has(f.input));
  const pascal = c.name.split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  const body = editable.map((f) => `  ${f.field}: ${zodField(f)},`).join("\n");
  const statuses = c.statuses
    ? `\nexport const ${c.name}Statuses = [${c.statuses.map((s) => `"${s}"`).join(", ")}] as const;\nexport type ${pascal}Status = (typeof ${c.name}Statuses)[number];\n`
    : "";
  return {
    path: join("lib", "schemas", `${c.name}.ts`),
    content: `${BANNER}
import { z } from "zod";

/** ${c.label} — editable form fields only. Read-only and generated fields are excluded. */
export const ${c.name}Schema = z.object({
${body}
});

export type ${pascal}Input = z.infer<typeof ${c.name}Schema>;
${statuses}`,
  };
});

// ---------- shared types ----------
const roleField = contracts.find((c) => c.name === "users")?.fields.find((f) => f.field === "role");
const validRoles = new Set(roleField?.validation?.enum ?? []);
const typesTs = `${BANNER}
export const ROLES = [${roleField.validation.enum.map((r) => `"${r}"`).join(", ")}] as const;
export type Role = (typeof ROLES)[number];

export const CONTRACT_TABLES = [${contracts.map((c) => `"${c.name}"`).join(", ")}] as const;
export type ContractTable = (typeof CONTRACT_TABLES)[number];

/** Every status any document can hold, union of all contracts. */
export const ALL_STATUSES = [${[...new Set(contracts.flatMap((c) => c.statuses ?? []))].map((s) => `"${s}"`).join(", ")}] as const;
export type AnyStatus = (typeof ALL_STATUSES)[number];
`;

// ---------- Lifecycle Codegen ----------
function getActionNamespace(contractName) {
  if (contractName === "grn") return "grn";
  if (contractName.endsWith("s")) return contractName;
  return contractName + "s";
}

const lifecycleContracts = contracts.filter((c) => c.lifecycle);

for (const c of lifecycleContracts) {
  const lc = c.lifecycle;
  if (!lc.initial || typeof lc.initial !== "string") {
    errors.push(`${c.name}.lifecycle: missing or invalid initial state`);
  }
  if (!lc.states || typeof lc.states !== "object" || Array.isArray(lc.states)) {
    errors.push(`${c.name}.lifecycle: missing or invalid states map`);
    continue;
  }
  if (!lc.states[lc.initial]) {
    errors.push(`${c.name}.lifecycle: initial state "${lc.initial}" is not defined in states`);
  }
  const declaredStates = new Set(Object.keys(lc.states));
  const validKinds = new Set(["editable", "locked", "closed", "in_transit", "received"]);

  for (const [sName, sDef] of Object.entries(lc.states)) {
    if (!validKinds.has(sDef.kind)) {
      errors.push(`${c.name}.lifecycle.states.${sName}: invalid kind "${sDef.kind}"`);
    }
    if (typeof sDef.terminal !== "boolean") {
      errors.push(`${c.name}.lifecycle.states.${sName}: 'terminal' must be boolean`);
    }
    if (sDef.badge && (typeof sDef.badge.label !== "string" || typeof sDef.badge.variant !== "string")) {
      errors.push(`${c.name}.lifecycle.states.${sName}: badge must have label and variant strings`);
    }
  }

  if (!Array.isArray(lc.transitions)) {
    errors.push(`${c.name}.lifecycle: transitions must be an array`);
    continue;
  }

  for (const t of lc.transitions) {
    if (!t.name || typeof t.name !== "string") {
      errors.push(`${c.name}.lifecycle: transition missing name`);
      continue;
    }
    if (!Array.isArray(t.from) || t.from.length === 0) {
      errors.push(`${c.name}.lifecycle.transitions.${t.name}: 'from' must be a non-empty array of states`);
    } else {
      for (const fromState of t.from) {
        if (!declaredStates.has(fromState)) {
          errors.push(`${c.name}.lifecycle.transitions.${t.name}: from state "${fromState}" not declared in states`);
        }
      }
    }
    if (!t.to || !declaredStates.has(t.to)) {
      errors.push(`${c.name}.lifecycle.transitions.${t.name}: to state "${t.to}" not declared in states`);
    }
    if (!Array.isArray(t.roles) || t.roles.length === 0) {
      errors.push(`${c.name}.lifecycle.transitions.${t.name}: 'roles' must be a non-empty array`);
    } else {
      for (const role of t.roles) {
        if (!validRoles.has(role)) {
          errors.push(`${c.name}.lifecycle.transitions.${t.name}: role "${role}" is not a valid user role`);
        }
      }
    }
    if (t.cascades) {
      if (!Array.isArray(t.cascades)) {
        errors.push(`${c.name}.lifecycle.transitions.${t.name}: cascades must be an array`);
      } else {
        for (const cascade of t.cascades) {
          if (!cascade.table || !tableNames.has(cascade.table)) {
            errors.push(`${c.name}.lifecycle.transitions.${t.name}: cascade table "${cascade.table}" is not a contract`);
          }
        }
      }
    }
  }
}

if (errors.length) {
  console.error("\n✖ Contract validation failed:\n" + errors.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}

// Emitting convex/lifecycle/<doc>.ts
const convexLifecycleFiles = lifecycleContracts.map((c) => {
  const pascal = c.name.split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  const screaming = c.name.toUpperCase();
  const lc = c.lifecycle;

  const statesEntries = Object.entries(lc.states)
    .map(([sName, sDef]) => {
      const badgeStr = sDef.badge ? `, badge: { label: "${sDef.badge.label}", variant: "${sDef.badge.variant}" }` : "";
      const ownerStr = sDef.owner ? `, owner: "${sDef.owner}"` : "";
      return `  ${sName}: { kind: "${sDef.kind}"${ownerStr}, terminal: ${sDef.terminal}${badgeStr} },`;
    })
    .join("\n");

  const transitionsEntries = lc.transitions
    .map((t) => {
      const fields = [
        `name: "${t.name}"`,
        t.label ? `label: "${t.label}"` : null,
        `from: [${t.from.map((s) => `"${s}"`).join(", ")}] as const`,
        `to: "${t.to}"`,
        `roles: [${t.roles.map((r) => `"${r}"`).join(", ")}] as const`,
        t.actor ? `actor: "${t.actor}"` : null,
        t.guards ? `guards: [${t.guards.map((g) => `"${g}"`).join(", ")}] as const` : null,
        t.cascades
          ? `cascades: [\n${t.cascades
              .map(
                (cas) =>
                  `      { table: "${cas.table}", from: [${cas.from.map((s) => `"${s}"`).join(", ")}] as const, to: "${cas.to}" }`
              )
              .join(",\n")}\n    ] as const`
          : null,
        t.requiresNote ? `requiresNote: true` : null,
      ]
        .filter(Boolean)
        .join(",\n    ");

      return `  {\n    ${fields},\n  },`;
    })
    .join("\n");

  const content = `${BANNER}
export interface CascadeRule {
  readonly table: string;
  readonly from: readonly string[];
  readonly to: string;
}

export interface TransitionDef<TState extends string = string, TRole extends string = string> {
  readonly name: string;
  readonly label?: string;
  readonly from: readonly TState[];
  readonly to: TState;
  readonly roles: readonly TRole[];
  readonly actor?: string;
  readonly guards?: readonly string[];
  readonly cascades?: readonly CascadeRule[];
  readonly requiresNote?: boolean;
}

export type ${pascal}State = ${c.statuses.map((s) => `"${s}"`).join(" | ")};

export const ${screaming}_INITIAL_STATE: ${pascal}State = "${lc.initial}";

export const ${screaming}_STATES = {
${statesEntries}
} as const;

export const ${screaming}_TRANSITIONS = [
${transitionsEntries}
] as const satisfies readonly TransitionDef<${pascal}State>[];

export type ${pascal}TransitionName = (typeof ${screaming}_TRANSITIONS)[number]["name"];
`;

  return {
    path: join("convex", "lifecycle", `${c.name}.ts`),
    content,
  };
});

// Emitting lib/lifecycle/<doc>.ts
const libLifecycleFiles = lifecycleContracts.map((c) => {
  const pascal = c.name.split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  const screaming = c.name.toUpperCase();
  const lc = c.lifecycle;

  const openStates = Object.entries(lc.states)
    .filter(([_, def]) => !def.terminal)
    .map(([sName]) => `"${sName}"`);

  const closedStates = Object.entries(lc.states)
    .filter(([_, def]) => def.terminal)
    .map(([sName]) => `"${sName}"`);

  const editableStates = Object.entries(lc.states)
    .filter(([_, def]) => def.kind === "editable")
    .map(([sName]) => `"${sName}"`);

  const lockedStates = Object.entries(lc.states)
    .filter(([_, def]) => def.kind === "locked")
    .map(([sName]) => `"${sName}"`);

  const badgesEntries = Object.entries(lc.states)
    .map(([sName, def]) => {
      const label = def.badge?.label ?? sName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      const variant = def.badge?.variant ?? (def.terminal ? "secondary" : "default");
      return `  ${sName}: { label: "${label}", variant: "${variant}" },`;
    })
    .join("\n");

  const content = `${BANNER}
import type { ${pascal}Status } from "@/lib/schemas/${c.name}";

export type ${pascal}StateKind = "editable" | "locked" | "closed" | "in_transit" | "received";

export const ${screaming}_OPEN_STATES: readonly ${pascal}Status[] = [${openStates.join(", ")}] as const;

export const ${screaming}_CLOSED_STATES: readonly ${pascal}Status[] = [${closedStates.join(", ")}] as const;

export const ${screaming}_EDITABLE_STATES: readonly ${pascal}Status[] = [${editableStates.join(", ")}] as const;

export const ${screaming}_LOCKED_STATES: readonly ${pascal}Status[] = [${lockedStates.join(", ")}] as const;

export const ${screaming}_STATUS_BADGES: Record<
  ${pascal}Status,
  { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }
> = {
${badgesEntries}
} as const;
`;

  return {
    path: join("lib", "lifecycle", `${c.name}.ts`),
    content,
  };
});

// Emitting convex/lifecycle/permissions.generated.ts
const lifecyclePermissionEntries = [];
for (const c of lifecycleContracts) {
  const ns = getActionNamespace(c.name);
  for (const t of c.lifecycle.transitions) {
    const actionKey = `${ns}:${t.name}`;
    const rolesStr = t.roles.map((r) => `"${r}"`).join(", ");
    lifecyclePermissionEntries.push(`  "${actionKey}": [${rolesStr}] as const,`);
  }
}

const permissionsGeneratedTs = `${BANNER}
import type { UserRole } from "@/convex/permissions";

export const GENERATED_LIFECYCLE_PERMISSIONS = {
${lifecyclePermissionEntries.join("\n")}
} as const satisfies Record<string, readonly UserRole[]>;

export type GeneratedLifecycleActionName = keyof typeof GENERATED_LIFECYCLE_PERMISSIONS;
`;

// Barrel exports
const registryImports = lifecycleContracts
  .map((c) => {
    const screaming = c.name.toUpperCase();
    return `import {
  ${screaming}_INITIAL_STATE,
  ${screaming}_STATES,
  ${screaming}_TRANSITIONS,
} from "./${c.name}";`;
  })
  .join("\n");

const registryEntries = lifecycleContracts
  .map((c) => {
    const screaming = c.name.toUpperCase();
    return `  ${c.name}: {
    initial: ${screaming}_INITIAL_STATE,
    states: ${screaming}_STATES,
    transitions: ${screaming}_TRANSITIONS,
  },`;
  })
  .join("\n");

const convexLifecycleIndexTs = `${BANNER}
${registryImports}

${lifecycleContracts.map((c) => `export * from "./${c.name}";`).join("\n")}
export * from "./permissions.generated";

export const LIFECYCLE_REGISTRY = {
${registryEntries}
} as const;

export type LifecycleTable = keyof typeof LIFECYCLE_REGISTRY;
`;

const libLifecycleIndexTs = `${BANNER}
${lifecycleContracts.map((c) => `export * from "./${c.name}";`).join("\n")}
`;

// ---------- write ----------
const outputs = [
  { path: join("convex", "schema.ts"), content: schemaTs },
  { path: join("lib", "contract-types.ts"), content: typesTs },
  ...zodFiles,
  ...convexLifecycleFiles,
  ...libLifecycleFiles,
  { path: join("convex", "lifecycle", "permissions.generated.ts"), content: permissionsGeneratedTs },
  { path: join("convex", "lifecycle", "index.ts"), content: convexLifecycleIndexTs },
  { path: join("lib", "lifecycle", "index.ts"), content: libLifecycleIndexTs },
];

let stale = 0;
for (const o of outputs) {
  const abs = join(ROOT, o.path);
  const prev = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (prev === o.content) { console.log(`  = ${o.path}`); continue; }
  stale++;
  if (CHECK) { console.error(`  ✖ stale: ${o.path}`); continue; }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, o.content);
  console.log(`  ${prev === null ? "+" : "~"} ${o.path}`);
}

if (warnings.length) console.warn("\n⚠ " + warnings.join("\n⚠ "));
if (CHECK && stale) {
  console.error(`\n✖ ${stale} generated file(s) out of date. Run: node scripts/generate-from-contracts.mjs\n`);
  process.exit(1);
}
console.log(`\n✔ ${contracts.length} contracts → ${outputs.length} files${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : ""}\n`);
