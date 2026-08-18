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
    if (c.audit.trackCreatedBy) lines.push(`    createdBy: v.id("users"),`);
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
const typesTs = `${BANNER}
export const ROLES = [${roleField.validation.enum.map((r) => `"${r}"`).join(", ")}] as const;
export type Role = (typeof ROLES)[number];

export const CONTRACT_TABLES = [${contracts.map((c) => `"${c.name}"`).join(", ")}] as const;
export type ContractTable = (typeof CONTRACT_TABLES)[number];

/** Every status any document can hold, union of all contracts. */
export const ALL_STATUSES = [${[...new Set(contracts.flatMap((c) => c.statuses ?? []))].map((s) => `"${s}"`).join(", ")}] as const;
export type AnyStatus = (typeof ALL_STATUSES)[number];
`;

// ---------- write ----------
const outputs = [
  { path: join("convex", "schema.ts"), content: schemaTs },
  { path: join("lib", "contract-types.ts"), content: typesTs },
  ...zodFiles,
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
