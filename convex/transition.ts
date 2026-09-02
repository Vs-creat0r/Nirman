/**
 * @fileoverview Universal transition helper & audit log writer.
 *
 * Central engine for all document status transitions across Nirman ERP.
 *
 * Automatically:
 * 1. Resolves transition rules (from, to, roles, cascades) from generated LIFECYCLE_REGISTRY
 * 2. Enforces RBAC permissions via requirePermission()
 * 3. Enforces data scoping boundaries via assertDocumentAccess()
 * 4. Validates the expected source status (`from` guard)
 * 5. Updates document status + timestamps + audit metadata
 * 6. Executes declared parent cascades with fail-loud validation
 * 7. Appends immutable audit log entries to the `logs` table
 */

import { MutationCtx } from "./_generated/server";
import { Id, TableNames } from "./_generated/dataModel";
import { requirePermission, ActionName, UserRole } from "./permissions";
import { resolveCallerScope, assertDocumentAccess } from "./scoping";
import { LIFECYCLE_REGISTRY, LifecycleTable } from "./lifecycle";

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

function getActionNamespace(table: string): string {
  if (table === "grn") return "grn";
  if (table.endsWith("s")) return table;
  return table + "s";
}

function resolveParentId(doc: Record<string, unknown>, targetTable: string): string | undefined {
  if (targetTable === "material_request" && typeof doc.materialRequestId === "string") {
    return doc.materialRequestId;
  }
  if (targetTable === "purchase_order" && typeof doc.purchaseOrderId === "string") {
    return doc.purchaseOrderId;
  }
  if (targetTable === "cost_comparison" && typeof doc.costComparisonId === "string") {
    return doc.costComparisonId;
  }
  if (targetTable === "delivery_challan" && typeof doc.deliveryChallanId === "string") {
    return doc.deliveryChallanId;
  }
  return undefined;
}

export interface TransitionParams<T extends TableNames> {
  table: T;
  documentId: Id<T>;
  transitionName?: string;
  action?: ActionName;
  to?: string;
  from?: string | string[];
  token?: string;
  note?: string;
  patch?: Record<string, unknown>;
  executeCascades?: boolean;
}

/**
 * Executes a status transition on a document and writes audit log row(s).
 */
export async function transition<T extends TableNames>(
  ctx: MutationCtx,
  params: TransitionParams<T>
) {
  const {
    table,
    documentId,
    transitionName,
    token,
    note,
    patch = {},
    executeCascades = true,
  } = params;

  let resolvedAction: ActionName = params.action as ActionName;
  let resolvedFrom: readonly string[] | undefined = Array.isArray(params.from)
    ? params.from
    : params.from
      ? [params.from]
      : undefined;
  let resolvedTo: string = params.to || "";
  let declaredCascades: ReadonlyArray<{
    table: string;
    from: readonly string[];
    to: string;
  }> = [];

  // 1. Resolve from LIFECYCLE_REGISTRY if transitionName is provided
  if (transitionName) {
    const tableConfig = LIFECYCLE_REGISTRY[table as unknown as LifecycleTable];
    if (!tableConfig) {
      throw new Error(`Lifecycle machine is not registered for table "${table}".`);
    }

    const tDef = tableConfig.transitions.find(
      (t: { name: string }) => t.name === transitionName
    );
    if (!tDef) {
      throw new Error(
        `Transition "${transitionName}" is not declared in lifecycle for table "${table}".`
      );
    }

    const ns = getActionNamespace(table);
    resolvedAction = `${ns}:${transitionName}` as ActionName;
    resolvedFrom = tDef.from as readonly string[];
    resolvedTo = tDef.to;
    if (tDef.cascades) {
      declaredCascades = tDef.cascades;
    }
  }

  if (!resolvedAction) {
    throw new Error(
      `Transition on table "${table}" requires either transitionName or action.`
    );
  }
  if (!resolvedTo) {
    throw new Error(
      `Transition on table "${table}" requires a target "to" status.`
    );
  }

  // 2. Authenticate & Authorize against centralized permission matrix
  const user = await requirePermission(ctx, resolvedAction, token);

  // 3. Fetch document
  const doc: any = await ctx.db.get(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found in table "${table}".`);
  }

  // 4. Enforce document-level data scoping & IDOR prevention
  const scopedTables: TableNames[] = [
    "material_request",
    "cost_comparison",
    "purchase_order",
    "delivery_challan",
    "grn",
  ];
  if (scopedTables.includes(table)) {
    const scope = await resolveCallerScope(ctx, token);
    assertDocumentAccess(scope, doc, doc.refNo || (documentId as string));
  }

  // 5. Verify status guard
  const currentStatus = doc.status;
  if (resolvedFrom !== undefined && resolvedFrom.length > 0) {
    if (!resolvedFrom.includes(currentStatus)) {
      throw new Error(
        `Invalid status transition on ${table} (${doc.refNo || documentId}): Expected status [${resolvedFrom.join(
          ", "
        )}], but current status is "${currentStatus}".`
      );
    }
  }

  const now = new Date().toISOString();

  // 6. Update document payload
  const updateData: Record<string, unknown> = {
    ...patch,
    status: resolvedTo,
    updatedBy: user._id,
    updatedAt: now,
  };

  await ctx.db.patch(documentId, updateData as any);

  // 7. Append immutable row to logs table
  const refNo = doc.refNo || (documentId as string);

  await ctx.db.insert("logs", {
    actorId: user._id,
    actorRole: user.role as UserRole,
    action: resolvedAction,
    documentType: table as TransitionDocumentType,
    documentId: documentId as string,
    referenceId: refNo,
    fromStatus: currentStatus,
    toStatus: resolvedTo,
    note: note || undefined,
    timestamp: now,
  });

  // 8. Execute declared cascades with fail-loud validation
  if (executeCascades && declaredCascades.length > 0) {
    for (const cascade of declaredCascades) {
      const parentId = resolveParentId(doc, cascade.table);
      if (!parentId) {
        throw new Error(
          `Cascade resolution failed: Document ${documentId} (${table}) has no valid reference for cascade target "${cascade.table}".`
        );
      }

      const parentDoc: any = await ctx.db.get(parentId as any);
      if (!parentDoc) {
        throw new Error(
          `Cascade target document ${parentId} in table "${cascade.table}" not found.`
        );
      }

      const parentCurrentStatus = parentDoc.status;
      if (!cascade.from.includes(parentCurrentStatus)) {
        throw new Error(
          `Invalid cascade status transition on parent ${cascade.table} (${parentDoc.refNo || parentId}): Expected [${cascade.from.join(
            ", "
          )}], but current status is "${parentCurrentStatus}".`
        );
      }

      if (parentCurrentStatus !== cascade.to) {
        await ctx.db.patch(parentId as any, {
          status: cascade.to,
          updatedBy: user._id,
          updatedAt: now,
        });

        const cascadeActionNs = getActionNamespace(cascade.table);
        const cascadeActionKey = `${cascadeActionNs}:advance_on_${table}_${transitionName}` as ActionName;

        await ctx.db.insert("logs", {
          actorId: user._id,
          actorRole: user.role as UserRole,
          action: (resolvedAction.startsWith(cascadeActionNs) ? resolvedAction : cascadeActionKey) as any,
          documentType: cascade.table as TransitionDocumentType,
          documentId: parentId,
          referenceId: parentDoc.refNo || parentId,
          fromStatus: parentCurrentStatus,
          toStatus: cascade.to,
          note: `Cascaded from ${table} (${refNo}) transition "${transitionName}".`,
          timestamp: now,
        });
      }
    }
  }

  return {
    success: true,
    documentId,
    refNo,
    fromStatus: currentStatus,
    toStatus: resolvedTo,
    actorId: user._id,
  };
}
