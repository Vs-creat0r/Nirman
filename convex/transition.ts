/**
 * @fileoverview Universal transition helper & audit log writer.
 *
 * Central engine for all document status transitions across Nirman ERP
 * (Material Requests, RFQs, Cost Comparisons, POs, DCs, GRNs).
 *
 * Automatically:
 * 1. Enforces RBAC permissions via requireRole()
 * 2. Validates the expected source status (`from` guard)
 * 3. Updates document status + timestamps + audit metadata
 * 4. Appends an immutable audit log entry to the `logs` table
 */

import { MutationCtx, mutation } from "./_generated/server";
import { Id, TableNames } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireRole, UserRole } from "./rbac";

export type TransitionDocumentType =
  | "material_request"
  | "rfq"
  | "cost_comparison"
  | "purchase_order"
  | "delivery_challan"
  | "grn"
  | "vendors"
  | "users"
  | "projects";

export interface TransitionParams<T extends TableNames> {
  table: T;
  documentId: Id<T>;
  from?: string | string[];
  to: string;
  actorRole: UserRole[];
  token?: string;
  action?: string;
  note?: string;
  patch?: Record<string, unknown>;
}

/**
 * Executes a status transition on a document and writes an audit log row.
 */
export async function transition<T extends TableNames>(
  ctx: MutationCtx,
  params: TransitionParams<T>
) {
  const {
    table,
    documentId,
    from,
    to,
    actorRole,
    token,
    action = `transition_to_${to}`,
    note,
    patch = {},
  } = params;

  // 1. Authenticate & Authorize
  const user = await requireRole(ctx, actorRole, token);

  // 2. Fetch document
  const doc: any = await ctx.db.get(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found in table "${table}".`);
  }

  // 3. Verify status guard
  const currentStatus = doc.status;
  if (from !== undefined) {
    const expected = Array.isArray(from) ? from : [from];
    if (!expected.includes(currentStatus)) {
      throw new Error(
        `Invalid status transition on ${table} (${doc.refNo || documentId}): Expected status [${expected.join(
          ", "
        )}], but current status is "${currentStatus}".`
      );
    }
  }

  const now = new Date().toISOString();

  // 4. Update document payload
  const updateData: Record<string, unknown> = {
    ...patch,
    status: to,
    updatedBy: user._id,
    updatedAt: now,
  };

  // Apply update to document
  await ctx.db.patch(documentId, updateData as any);

  // 5. Append immutable row to logs table
  const refNo = doc.refNo || (documentId as string);

  await ctx.db.insert("logs", {
    actorId: user._id,
    actorRole: user.role as UserRole,
    action,
    documentType: table as TransitionDocumentType,
    documentId: documentId as string,
    referenceId: refNo,
    fromStatus: currentStatus,
    toStatus: to,
    note: note || undefined,
    timestamp: now,
  });

  return {
    success: true,
    documentId,
    refNo,
    fromStatus: currentStatus,
    toStatus: to,
    actorId: user._id,
  };
}

