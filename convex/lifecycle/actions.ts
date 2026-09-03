/**
 * @fileoverview Server-Authoritative Available Actions Engine.
 *
 * Implements S3-06:
 * Queries the active document's state, caller permissions, and evaluates
 * all declarative guards to determine available and disabled actions with reasons.
 *
 * Designed for both UI button rendering (Day 4) and autonomous AI agent consumption (Stage 6).
 */

import { query } from "@/convex/_generated/server";
import { v } from "convex/values";
import { Id, TableNames } from "@/convex/_generated/dataModel";
import { UserRole } from "@/convex/permissions";
import { resolveCallerScope, assertDocumentAccess } from "@/convex/scoping";
import { LIFECYCLE_REGISTRY, LifecycleTable, TransitionDef } from "./index";
import { evaluateGuard } from "./guards";

export interface AvailableActionItem {
  readonly name: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly requiresNote: boolean;
  readonly roles: readonly string[];
  readonly to: string;
}

export interface AvailableActionsResult {
  readonly status: string;
  readonly actions: readonly AvailableActionItem[];
}

/**
 * Pure evaluation function for computing available actions on a document.
 * Used by the Convex query and unit test suites.
 */
export function computeAvailableActions(
  table: string,
  doc: Record<string, unknown> & { status: string; createdBy?: string },
  caller: { _id: string; role: UserRole }
): AvailableActionsResult {
  const machine = LIFECYCLE_REGISTRY[table as LifecycleTable];
  if (!machine) {
    throw new Error(`Lifecycle machine not found for table "${table}".`);
  }

  const currentStatus = doc.status;
  const actions: AvailableActionItem[] = [];

  for (const t of machine.transitions as readonly TransitionDef[]) {
    // 1. Check if transition is valid from current status
    if (!(t.from as readonly string[]).includes(currentStatus)) {
      continue;
    }

    let enabled = true;
    let reason: string | undefined = undefined;

    // 2. Check role authorization
    if (!t.roles.includes(caller.role)) {
      enabled = false;
      reason = `Requires role: ${t.roles.join(" or ")}.`;
    }

    // 3. Check actor ownership (creator constraint)
    if (enabled && t.actor === "creator") {
      // Admins and Project Managers can act on behalf of their team
      const isPrivileged = caller.role === "admin" || caller.role === "project_manager";
      if (!isPrivileged && doc.createdBy && doc.createdBy !== caller._id) {
        enabled = false;
        reason = "Only the document creator can perform this action.";
      }
    }

    // 4. Evaluate declarative guards
    if (enabled && t.guards && t.guards.length > 0) {
      for (const guard of t.guards) {
        const guardRes = evaluateGuard(guard, doc);
        if (!guardRes.passed) {
          enabled = false;
          reason = guardRes.reason;
          break;
        }
      }
    }

    const defaultLabel = t.name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    actions.push({
      name: t.name,
      label: t.label || defaultLabel,
      enabled,
      reason,
      requiresNote: t.requiresNote ?? false,
      roles: t.roles,
      to: t.to,
    });
  }

  return {
    status: currentStatus,
    actions,
  };
}

/**
 * Public Convex Query: resolves caller and returns valid available actions.
 */
export const availableActions = query({
  args: {
    table: v.string(),
    documentId: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AvailableActionsResult> => {
    const table = args.table as TableNames;
    const documentId = args.documentId as Id<TableNames>;

    // 1. Authenticate caller and resolve scope
    const scope = await resolveCallerScope(ctx, args.token);
    const user = scope.user;
    if (!user || !user.isActive) {
      throw new Error("Unauthorized: Invalid or inactive user session.");
    }

    // 2. Fetch document
    const doc = (await ctx.db.get(documentId)) as
      | (Record<string, unknown> & { _id: Id<TableNames>; status: string; refNo?: string; createdBy?: string })
      | null;

    if (!doc) {
      throw new Error(`Document ${args.documentId} not found in table "${args.table}".`);
    }

    // 3. Enforce document-level scoping boundaries
    assertDocumentAccess(scope, doc as any, doc.refNo || (documentId as string));

    // 4. Compute server-authoritative actions
    return computeAvailableActions(table, doc, {
      _id: user._id,
      role: user.role as UserRole,
    });
  },
});
