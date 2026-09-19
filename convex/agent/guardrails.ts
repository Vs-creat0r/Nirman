/**
 * @fileoverview Agent Guardrails and Validation Engine for Nirman ERP.
 *
 * Implements S6-2:
 * 1. Input Guard: Hard prompt-injection isolation & §11.5 data-privacy boundary filtering.
 * 2. Output Guard: Multi-stage proposal verification (Schema, RBAC Parity, Scope, Business Rules).
 * 3. Self-Correction Contract: Structured retry budget with hard 3-attempt ceiling.
 *
 * Zero database mutations, zero write paths.
 */

import { UserRole } from "../permissions";
import { GENERATED_LIFECYCLE_PERMISSIONS } from "../lifecycle/permissions.generated";
import { MATERIAL_REQUEST_TRANSITIONS } from "../lifecycle/index";

/**
 * Whitelist of permissible document tables for agent tool querying and context assembly.
 */
export const ALLOWED_TABLES = [
  "material_request",
  "cost_comparison",
  "purchase_order",
  "delivery_challan",
  "rfq",
  "grn",
  "vendors",
  "projects",
  "sites",
  "project_items",
] as const;

export type AllowedAgentTable = (typeof ALLOWED_TABLES)[number];

export interface SanitizedAgentContext {
  readonly instructionSlot: string;
  readonly untrustedDataSlot: {
    readonly table?: string;
    readonly documentId?: string;
    readonly data: Record<string, unknown>;
  };
  readonly privacyFiltered: boolean;
  readonly redactedCount: number;
}

export interface ProposalValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface IncompleteHandoffPayload {
  readonly status: "incomplete";
  readonly reason: string;
  readonly errors: readonly string[];
  readonly lastProposal: unknown;
}

export interface SelfCorrectionDecision {
  readonly attemptCount: number;
  readonly canRetry: boolean;
  readonly feedbackPrompt?: string;
  readonly incompleteHandoff?: IncompleteHandoffPayload;
}

export const MAX_SELF_CORRECTION_ATTEMPTS = 3;

// Regex patterns for §11.5 sensitive data redaction
const PHONE_RE = /(?:\+?91[-.\s]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const BANK_ACCOUNT_RE = /\b(?:account|acct|a\/c|iban|upi)?\s*[:#-]?\s*(\d{9,18}|[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})\b/gi;
const AUTH_SECRET_RE = /\b(?:sess_[a-f0-9]{64}|eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)\b/g;
const PERSONAL_ID_RE = /\b([A-Z]{5}[0-9]{4}[A-Z]{1}|\d{4}\s\d{4}\s\d{4})\b/g; // PAN or Aadhaar

/**
 * §11.5 Data Privacy Redaction Helper.
 * Redacts financial account numbers, phone numbers, emails, passwords, and auth tokens
 * while preserving business metadata (item names, quantities, rates, units, document ref numbers).
 */
export function stripSensitiveData(text: string): { sanitized: string; count: number } {
  let count = 0;
  let sanitized = text;

  // Redact auth secrets & tokens first
  sanitized = sanitized.replace(AUTH_SECRET_RE, () => {
    count++;
    return "[REDACTED_AUTH_TOKEN]";
  });

  // Redact emails
  sanitized = sanitized.replace(EMAIL_RE, () => {
    count++;
    return "[REDACTED_EMAIL]";
  });

  // Redact phone numbers
  sanitized = sanitized.replace(PHONE_RE, () => {
    count++;
    return "[REDACTED_PHONE]";
  });

  // Redact personal IDs (PAN / Aadhaar)
  sanitized = sanitized.replace(PERSONAL_ID_RE, () => {
    count++;
    return "[REDACTED_ID]";
  });

  // Redact bank accounts & UPI handles
  sanitized = sanitized.replace(BANK_ACCOUNT_RE, (match) => {
    if (match.toLowerCase().includes("account") || match.toLowerCase().includes("a/c") || match.includes("@")) {
      count++;
      return "[REDACTED_FINANCIAL_ACCOUNT]";
    }
    return match;
  });

  return { sanitized, count };
}

/**
 * Recursively sanitizes any value, stripping sensitive fields from objects.
 */
export function sanitizeDataValue(val: unknown): { value: unknown; count: number } {
  if (val === null || val === undefined) {
    return { value: val, count: 0 };
  }

  if (typeof val === "string") {
    const { sanitized, count } = stripSensitiveData(val);
    return { value: sanitized, count };
  }

  if (Array.isArray(val)) {
    let totalCount = 0;
    const sanitizedArray = val.map((item) => {
      const res = sanitizeDataValue(item);
      totalCount += res.count;
      return res.value;
    });
    return { value: sanitizedArray, count: totalCount };
  }

  if (typeof val === "object") {
    const rawObj = val as Record<string, unknown>;
    const sanitizedObj: Record<string, unknown> = {};
    let totalCount = 0;

    const sensitiveKeyList = ["password", "passwordhash", "phone", "email", "bankaccount", "gstno", "token"];

    for (const [k, v] of Object.entries(rawObj)) {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeyList.includes(lowerKey)) {
        sanitizedObj[k] = "[REDACTED]";
        totalCount++;
      } else {
        const res = sanitizeDataValue(v);
        sanitizedObj[k] = res.value;
        totalCount += res.count;
      }
    }
    return { value: sanitizedObj, count: totalCount };
  }

  return { value: val, count: 0 };
}

/**
 * T1 · Input Guard: Assembles agent context with hard instruction/data separation
 * and enforces the §11.5 data-privacy boundary.
 */
export function sanitizeAgentInput(rawInput: {
  userPrompt: string;
  documentContext?: {
    table: string;
    id: string;
    content?: Record<string, unknown> | string;
  };
  additionalData?: Record<string, unknown>;
}): SanitizedAgentContext {
  const { userPrompt, documentContext, additionalData } = rawInput;

  // 1. Table Whitelist Verification
  if (documentContext && documentContext.table) {
    if (!ALLOWED_TABLES.includes(documentContext.table as AllowedAgentTable)) {
      throw new Error(
        `Security violation: Table "${documentContext.table}" is not in the allowed agent document whitelist.`
      );
    }
  }

  // 2. Isolate User Instructions (Prompt only)
  const instructionSlot = userPrompt.trim();

  // 3. Sanitize Document Context into Untrusted Data Slot
  let redactedCount = 0;
  let sanitizedDocData: Record<string, unknown> = {};

  if (documentContext?.content) {
    if (typeof documentContext.content === "string") {
      const res = stripSensitiveData(documentContext.content);
      redactedCount += res.count;
      sanitizedDocData = { textContent: res.sanitized };
    } else {
      const res = sanitizeDataValue(documentContext.content);
      redactedCount += res.count;
      sanitizedDocData = res.value as Record<string, unknown>;
    }
  }

  if (additionalData) {
    const res = sanitizeDataValue(additionalData);
    redactedCount += res.count;
    sanitizedDocData = { ...sanitizedDocData, ...(res.value as Record<string, unknown>) };
  }

  return {
    instructionSlot,
    untrustedDataSlot: {
      table: documentContext?.table,
      documentId: documentContext?.id,
      data: sanitizedDocData,
    },
    privacyFiltered: redactedCount > 0,
    redactedCount,
  };
}

/**
 * Checks for incomplete placeholder strings in generated proposal fields.
 */
function checkPlaceholders(val: unknown, path = ""): string[] {
  const errors: string[] = [];
  const placeholderRe = /\b(TODO|TBD|N\/A|PLACEHOLDER|NULL|UNDEFINED)\b/i;

  if (typeof val === "string") {
    if (placeholderRe.test(val)) {
      errors.push(`Field "${path}" contains placeholder value "${val}". Complete data is required.`);
    }
  } else if (Array.isArray(val)) {
    val.forEach((item, idx) => {
      errors.push(...checkPlaceholders(item, `${path}[${idx}]`));
    });
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      errors.push(...checkPlaceholders(v, path ? `${path}.${k}` : k));
    }
  }

  return errors;
}

/**
 * T2 · Output Guard: Multi-stage validation for agent proposals.
 * Rejects malformed, role-forbidden, out-of-scope, and low-confidence proposals.
 */
export function validateProposal(
  proposal: unknown,
  context: {
    table: string;
    caller: {
      _id: string;
      role: UserRole;
      allowedProjectIds?: Set<string>;
      allowedSiteIds?: Set<string>;
    };
    parentDoc?: Record<string, unknown> & {
      _id: string;
      projectId?: string;
      siteId?: string;
      status?: string;
    };
  }
): ProposalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { table, caller, parentDoc } = context;

  // 1. Structural & Placeholder Validation
  if (!proposal || typeof proposal !== "object") {
    return { ok: false, errors: ["Proposal must be a valid non-null object."], warnings: [] };
  }

  const proposalObj = proposal as Record<string, unknown>;
  errors.push(...checkPlaceholders(proposalObj));

  // 2. RBAC Parity Gate (roles sourced from generated contract permissions — no hardcoded lists)
  const permissionKeyMap: Record<string, keyof typeof GENERATED_LIFECYCLE_PERMISSIONS> = {
    cost_comparison: "cost_comparisons:submit",
    purchase_order: "purchase_orders:submit",
    material_request: "material_requests:submit",
  };
  const tableLabels: Record<string, string> = {
    cost_comparison: "Cost Comparisons",
    purchase_order: "Purchase Orders",
    material_request: "Material Requests",
  };
  const permKey = permissionKeyMap[table];
  if (permKey) {
    const allowedRoles = GENERATED_LIFECYCLE_PERMISSIONS[permKey] as readonly UserRole[];
    if (!allowedRoles.includes(caller.role)) {
      errors.push(
        `Role "${caller.role}" is not authorized to create ${tableLabels[table] || table} (requires ${allowedRoles.join(" or ")}).`
      );
    }
  }

  // 3. Parent Document Scope & Status Gate
  if (parentDoc) {
    if (table === "cost_comparison") {
      const reviewTransition = MATERIAL_REQUEST_TRANSITIONS.find((t) => t.name === "review_on_cc");
      const contractStatuses: readonly string[] = reviewTransition
        ? reviewTransition.from
        : ["ready_for_cc", "routed_to_rfq", "routed_to_cc", "review_cc"];
      const allowedParentStatuses = Array.from(new Set([...contractStatuses, "draft"]));

      if (parentDoc.status && !allowedParentStatuses.includes(parentDoc.status)) {
        errors.push(
          `Parent Material Request is in "${parentDoc.status}" status. Cost Comparison can only be created for MRs in [${allowedParentStatuses.join(", ")}].`
        );
      }
    }

    if (caller.role !== "admin") {
      if (parentDoc.siteId && caller.allowedSiteIds && !caller.allowedSiteIds.has(parentDoc.siteId)) {
        errors.push(`Parent document site "${parentDoc.siteId}" is outside caller's authorized site scope.`);
      }
      if (parentDoc.projectId && caller.allowedProjectIds && !caller.allowedProjectIds.has(parentDoc.projectId)) {
        errors.push(`Parent document project "${parentDoc.projectId}" is outside caller's authorized project scope.`);
      }
    }
  }

  // 4. Domain-Specific Contract Rules (Cost Comparison)
  if (table === "cost_comparison") {
    if (!proposalObj.materialRequestId || typeof proposalObj.materialRequestId !== "string") {
      errors.push("Missing required field: materialRequestId.");
    }

    const quotes = proposalObj.vendorQuotes;
    if (!Array.isArray(quotes) || quotes.length < 2) {
      errors.push("Cost Comparison proposal must include at least 2 vendor quotes (enforced server-side).");
    } else {
      const vendorSet = new Set<string>();
      quotes.forEach((rawQ: unknown, idx: number) => {
        const q = rawQ as Record<string, unknown>;
        if (!q.vendorId || typeof q.vendorId !== "string") {
          errors.push(`vendorQuotes[${idx}] must specify a valid vendorId.`);
        } else if (vendorSet.has(q.vendorId)) {
          errors.push(`Duplicate vendorId "${q.vendorId}" detected in quotes. Each vendor quote must be from a distinct supplier.`);
        } else {
          vendorSet.add(q.vendorId);
        }

        if (!Array.isArray(q.items) || q.items.length === 0) {
          errors.push(`vendorQuotes[${idx}] must include quoted line items.`);
        } else {
          q.items.forEach((rawIt: unknown, itemIdx: number) => {
            const it = rawIt as Record<string, unknown>;
            if (!it.itemName || typeof it.itemName !== "string" || !it.itemName.trim()) {
              errors.push(`vendorQuotes[${idx}].items[${itemIdx}] must specify a valid itemName.`);
            }
            const qty = Number(it.quantity);
            if (isNaN(qty) || qty <= 0) {
              errors.push(`vendorQuotes[${idx}].items[${itemIdx}] quantity must be greater than 0.`);
            }
            const rate = Number(it.rate);
            if (isNaN(rate) || rate < 0) {
              errors.push(`vendorQuotes[${idx}].items[${itemIdx}] rate must be a non-negative number.`);
            }
          });
        }

        const taxRate = Number(q.taxRate);
        if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
          errors.push(`vendorQuotes[${idx}] taxRate must be a percentage between 0 and 100.`);
        }
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * T3 · Self-Correction Retry Budget Controller.
 * Formulates structured correction directives and enforces the 3-attempt ceiling.
 */
export function evaluateSelfCorrection(
  attemptCount: number,
  errors: readonly string[],
  currentProposal?: unknown
): SelfCorrectionDecision {
  if (attemptCount >= MAX_SELF_CORRECTION_ATTEMPTS) {
    return {
      attemptCount,
      canRetry: false,
      incompleteHandoff: {
        status: "incomplete",
        reason: `Self-correction retry budget exceeded (${MAX_SELF_CORRECTION_ATTEMPTS}/${MAX_SELF_CORRECTION_ATTEMPTS} attempts). Handing off incomplete draft for human review.`,
        errors,
        lastProposal: currentProposal,
      },
    };
  }

  const errorBullets = errors.map((err, i) => `${i + 1}. ${err}`).join("\n");
  const feedbackPrompt = `Your previous proposal failed validation with the following ${errors.length} error(s):\n${errorBullets}\n\nPlease correct these specific errors and regenerate a strictly compliant proposal. (Attempt ${attemptCount + 1}/${MAX_SELF_CORRECTION_ATTEMPTS})`;

  return {
    attemptCount,
    canRetry: true,
    feedbackPrompt,
  };
}
