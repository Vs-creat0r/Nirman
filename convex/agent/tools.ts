/**
 * @fileoverview Read-only tool surface for Nirman AI Agentic Layer.
 *
 * Implements S6-1:
 * Pure read-only tools strictly bound by caller RBAC and project/site scoping.
 * Zero database mutations, zero write paths.
 */

import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, TableNames, Doc } from "../_generated/dataModel";
import { UserRole } from "../permissions";
import { resolveCallerScope, assertDocumentAccess } from "../scoping";
import { computeAvailableActions, AvailableActionsResult } from "../lifecycle/actions";
import { LIFECYCLE_REGISTRY, LifecycleTable } from "../lifecycle/index";

export interface VendorSearchResult {
  readonly vendor: Doc<"vendors">;
  readonly score: number;
  readonly matchReason: string;
}

export interface ExplainStatusResult {
  readonly table: string;
  readonly documentId: string;
  readonly refNo?: string;
  readonly status: string;
  readonly isTerminal: boolean;
  readonly explanation: string;
  readonly nextActions: readonly string[];
  readonly blockers: readonly string[];
}

function formatTableLabel(table: string): string {
  return table
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * T1 · Pure helper: read a single document with strict scoping enforcement.
 */
export async function readDocumentHelper(
  ctx: QueryCtx,
  args: { table: string; id: string; token?: string }
): Promise<Record<string, unknown>> {
  const scope = await resolveCallerScope(ctx, args.token);
  const doc = await ctx.db.get(args.id as Id<TableNames>);

  if (!doc) {
    throw new Error(`Document not found in table "${args.table}".`);
  }

  const docRecord = doc as unknown as Record<string, unknown> & { refNo?: string };
  assertDocumentAccess(scope, docRecord as { projectId?: Id<"projects">; siteId?: Id<"sites"> }, docRecord.refNo || args.id);

  return docRecord;
}

/**
 * T2 · Pure helper: list server-authoritative available actions for this caller.
 */
export async function listAvailableActionsHelper(
  ctx: QueryCtx,
  args: { table: string; id: string; token?: string }
): Promise<AvailableActionsResult> {
  const scope = await resolveCallerScope(ctx, args.token);
  const doc = await ctx.db.get(args.id as Id<TableNames>);

  if (!doc) {
    throw new Error(`Document not found in table "${args.table}".`);
  }

  const docRecord = doc as unknown as Record<string, unknown> & { status: string; refNo?: string; createdBy?: string };
  assertDocumentAccess(scope, docRecord as { projectId?: Id<"projects">; siteId?: Id<"sites"> }, docRecord.refNo || args.id);

  return computeAvailableActions(args.table, docRecord, {
    _id: String(scope.user._id),
    role: scope.user.role as UserRole,
  });
}

/**
 * T3 · Pure helper: explain document status and next steps in plain language.
 */
export async function explainStatusHelper(
  ctx: QueryCtx,
  args: { table: string; id: string; token?: string }
): Promise<ExplainStatusResult> {
  const scope = await resolveCallerScope(ctx, args.token);
  const doc = await ctx.db.get(args.id as Id<TableNames>);

  if (!doc) {
    throw new Error(`Document not found in table "${args.table}".`);
  }

  const docRecord = doc as unknown as Record<string, unknown> & { status: string; refNo?: string; reviewNote?: string; notes?: string; vendorQuotes?: unknown[] };
  assertDocumentAccess(scope, docRecord as { projectId?: Id<"projects">; siteId?: Id<"sites"> }, docRecord.refNo || args.id);

  const tableLabel = formatTableLabel(args.table);
  const refNo = typeof docRecord.refNo === "string" ? docRecord.refNo : undefined;
  const currentStatus = String(docRecord.status || "unknown");

  const machine = LIFECYCLE_REGISTRY[args.table as LifecycleTable];
  const stateMeta = machine ? (machine.states as Record<string, { terminal?: boolean }>)[currentStatus] : undefined;
  const isTerminal = Boolean(stateMeta?.terminal) || ["delivered", "approved", "rejected", "closed", "cancelled", "archived"].includes(currentStatus);

  const actionsResult = computeAvailableActions(args.table, docRecord, {
    _id: String(scope.user._id),
    role: scope.user.role as UserRole,
  });

  const nextActions: string[] = [];
  const blockers: string[] = [];
  const enabledUserActions = actionsResult.actions.filter((a) => a.enabled);
  const disabledActions = actionsResult.actions.filter((a) => !a.enabled);

  for (const act of enabledUserActions) {
    nextActions.push(`${act.label} (leads to "${act.to}")`);
  }

  for (const act of disabledActions) {
    if (act.reason) {
      blockers.push(`${act.label}: ${act.reason}`);
    }
  }

  // Resolve review/feedback note from contract fields or audit logs
  let feedbackNote: string | undefined = undefined;
  if (typeof docRecord.reviewNote === "string" && docRecord.reviewNote.trim()) {
    feedbackNote = docRecord.reviewNote.trim();
  } else if (typeof docRecord.notes === "string" && docRecord.notes.trim()) {
    feedbackNote = docRecord.notes.trim();
  }

  const explanationParts: string[] = [];
  const docIdentifier = refNo ? `${tableLabel} (${refNo})` : tableLabel;

  if (isTerminal) {
    explanationParts.push(`${docIdentifier} is in terminal status "${currentStatus}". No further workflow transitions are required.`);
  } else if (currentStatus === "draft") {
    if (args.table === "cost_comparison") {
      const quotes = Array.isArray(docRecord.vendorQuotes) ? docRecord.vendorQuotes : [];
      if (quotes.length < 2) {
        explanationParts.push(`${docIdentifier} is in "draft" status. It currently has ${quotes.length} vendor quote(s) and requires at least 2 vendor quotes before it can be submitted.`);
      } else {
        explanationParts.push(`${docIdentifier} is in "draft" status with ${quotes.length} vendor quotes. It is ready to be submitted for manager review.`);
      }
    } else {
      explanationParts.push(`${docIdentifier} is in "draft" status and is ready for submission.`);
    }
  } else if (currentStatus === "submitted" || currentStatus === "pending") {
    explanationParts.push(`${docIdentifier} is in "${currentStatus}" status, currently awaiting review and approval from a Project Manager or Administrator.`);
  } else if (currentStatus === "queried") {
    if (feedbackNote) {
      explanationParts.push(`${docIdentifier} has been queried with reviewer feedback: "${feedbackNote}". It must be updated and resubmitted.`);
    } else {
      explanationParts.push(`${docIdentifier} is in "queried" status. Reviewer clarifications must be addressed before resubmitting.`);
    }
  } else if (currentStatus === "rejected") {
    if (feedbackNote) {
      explanationParts.push(`${docIdentifier} was rejected with note: "${feedbackNote}".`);
    } else {
      explanationParts.push(`${docIdentifier} is in "rejected" status.`);
    }
  } else {
    explanationParts.push(`${docIdentifier} is currently in "${currentStatus}" status.`);
  }

  if (enabledUserActions.length > 0) {
    explanationParts.push(`Actions available to your role: ${enabledUserActions.map((a) => `"${a.label}"`).join(", ")}.`);
  } else if (!isTerminal) {
    explanationParts.push("Your current user role does not have permission to execute next-step actions on this document.");
  }

  return {
    table: args.table,
    documentId: args.id,
    refNo,
    status: currentStatus,
    isTerminal,
    explanation: explanationParts.join(" "),
    nextActions,
    blockers,
  };
}

/**
 * T4 · Pure helper: search real active vendor dataset with deterministic ranking.
 */
export async function searchVendorsHelper(
  ctx: QueryCtx,
  args: { query?: string; category?: string; status?: string; token?: string }
): Promise<VendorSearchResult[]> {
  await resolveCallerScope(ctx, args.token);

  let vendors = await ctx.db.query("vendors").collect();
  vendors = vendors.filter((v) => v.isActive);

  if (args.category && args.category.trim()) {
    const targetCat = args.category.trim().toLowerCase();
    vendors = vendors.filter((v) => v.category?.toLowerCase() === targetCat);
  }

  const rawQuery = (args.query || "").trim().toLowerCase();
  if (!rawQuery) {
    return [];
  }

  const tokens = rawQuery.split(/\s+/).filter(Boolean);
  const scored: VendorSearchResult[] = [];

  for (const v of vendors) {
    const name = (v.name || "").toLowerCase();
    const category = (v.category || "").toLowerCase();
    const contact = (v.contactPerson || "").toLowerCase();
    const address = (v.address || "").toLowerCase();

    let score = 0;
    const matchedFields: string[] = [];

    if (name === rawQuery) {
      score += 100;
      matchedFields.push("exact name match");
    } else if (name.startsWith(rawQuery)) {
      score += 60;
      matchedFields.push("name prefix");
    } else if (name.includes(rawQuery)) {
      score += 40;
      matchedFields.push("name match");
    }

    if (category === rawQuery) {
      score += 35;
      matchedFields.push("exact category match");
    } else if (category.includes(rawQuery)) {
      score += 20;
      matchedFields.push("category match");
    }

    let tokenMatches = 0;
    for (const t of tokens) {
      if (name.includes(t)) {
        tokenMatches += 15;
      }
      if (category.includes(t)) {
        tokenMatches += 10;
      }
      if (contact.includes(t)) {
        tokenMatches += 5;
      }
      if (address.includes(t)) {
        tokenMatches += 3;
      }
    }

    if (tokenMatches > 0 && !matchedFields.includes("name match") && !matchedFields.includes("exact name match")) {
      matchedFields.push("keyword token match");
    }

    score += tokenMatches;

    if (score > 0) {
      scored.push({
        vendor: v,
        score,
        matchReason: `Matched on ${matchedFields.join(", ")}`,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Validates caller session token and returns active user scope.
 */
export async function validateCallerScopeHelper(
  ctx: QueryCtx,
  args: { token?: string }
): Promise<{ _id: string; name: string; role: UserRole; isActive: boolean; isAdmin: boolean }> {
  const scope = await resolveCallerScope(ctx, args.token);
  return {
    _id: String(scope.user._id),
    name: scope.user.name,
    role: scope.user.role as UserRole,
    isActive: Boolean(scope.user.isActive),
    isAdmin: scope.isAdmin,
  };
}

// ── Public Convex Queries ──────────────────────────────────────────────

export const readDocument = query({
  args: {
    table: v.string(),
    id: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await readDocumentHelper(ctx, args);
  },
});

export const listAvailableActions = query({
  args: {
    table: v.string(),
    id: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await listAvailableActionsHelper(ctx, args);
  },
});

export const explainStatus = query({
  args: {
    table: v.string(),
    id: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await explainStatusHelper(ctx, args);
  },
});

export const searchVendors = query({
  args: {
    query: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await searchVendorsHelper(ctx, args);
  },
});

export const validateCallerScope = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await validateCallerScopeHelper(ctx, args);
  },
});
