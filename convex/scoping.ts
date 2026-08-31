/**
 * @fileoverview Central Data Scoping & Authorization Boundaries for Nirman ERP.
 *
 * Implements S1-04:
 * Enforces `assignedProjectIds` and `assignedSiteIds` boundaries across all queries.
 *
 * Scoping Rules:
 * 1. Admin: Global / Unrestricted access (isAdmin = true, isSiteScoped = false).
 * 2. Site Supervisor: Strictly site-scoped (isSiteScoped = true). If doc has siteId,
 *    it MUST be in `allowedSiteIds`. Parent projectId alone never grants access to foreign sites.
 * 3. Project Manager: Project-scoped (isSiteScoped = false). Full access to all sites
 *    under `assignedProjectIds`. Any specific `assignedSiteIds` EXTEND their access
 *    (e.g., to oversee a specific site in another project) and NEVER narrow it.
 * 4. Procurement Officer: Project-scoped to `assignedProjectIds`.
 * 5. Fail-Closed: If any non-admin role has 0 assignments, both `allowedProjectIds`
 *    and `allowedSiteIds` are empty, resulting in 0 visible documents and forbidden ID lookups.
 */

import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./rbac";

export interface UserScope {
  user: Doc<"users">;
  isAdmin: boolean;
  isSiteScoped: boolean;
  allowedProjectIds: Set<string>;
  allowedSiteIds: Set<string>;
}

/**
 * Resolves the authenticated caller's security scope and authorized project/site sets.
 * Throws immediately if token is missing, invalid, or user is deactivated.
 */
export async function resolveCallerScope(
  ctx: QueryCtx | MutationCtx,
  token?: string
): Promise<UserScope> {
  const user = await getCurrentUser(ctx, token);
  if (!user) {
    throw new Error("Unauthorized: Invalid or missing authentication token.");
  }

  if (!user.isActive) {
    throw new Error("Unauthorized: Your account has been deactivated. Contact an administrator.");
  }

  const isAdmin = user.role === "admin";
  if (isAdmin) {
    return {
      user,
      isAdmin: true,
      isSiteScoped: false,
      allowedProjectIds: new Set<string>(),
      allowedSiteIds: new Set<string>(),
    };
  }

  const rawProjectIds = (user.assignedProjectIds || []).map((id) => String(id));
  const rawSiteIds = (user.assignedSiteIds || []).map((id) => String(id));

  // Site Supervisor is strictly site-scoped
  if (user.role === "site_supervisor") {
    const allowedSiteIds = new Set<string>(rawSiteIds);
    const allowedProjectIds = new Set<string>();

    // Resolve parent project IDs for the supervisor's assigned sites via direct get()
    // Avoids a full sites table scan on every authenticated request.
    for (const siteIdStr of rawSiteIds) {
      try {
        const site = await ctx.db.get(siteIdStr as any);
        if (site && (site as any).projectId) {
          allowedProjectIds.add(String((site as any).projectId));
        }
      } catch {
        // Invalid ID format — skip
      }
    }

    return {
      user,
      isAdmin: false,
      isSiteScoped: true,
      allowedProjectIds,
      allowedSiteIds,
    };
  }

  // Project Manager and Procurement Officer: Project-scoped (sites extend access, never narrow)
  const allowedProjectIds = new Set<string>(rawProjectIds);
  const allowedSiteIds = new Set<string>(rawSiteIds);

  // Resolve all sites under allowed projects using the by_projectId index.
  // Avoids a full sites table scan on every authenticated request.
  for (const projectId of rawProjectIds) {
    const projectSites = await ctx.db
      .query("sites")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId as any))
      .collect();
    for (const site of projectSites) {
      allowedSiteIds.add(String(site._id));
    }
  }

  return {
    user,
    isAdmin: false,
    isSiteScoped: false,
    allowedProjectIds,
    allowedSiteIds,
  };
}

/**
 * Predicate checking whether the given user scope has authorization to access a document.
 */
export function canAccessDocument(
  scope: UserScope,
  doc: { projectId?: Id<"projects"> | string | null; siteId?: Id<"sites"> | string | null }
): boolean {
  if (scope.isAdmin) return true;

  // 1. If document has a siteId
  if (doc.siteId) {
    const siteIdStr = String(doc.siteId);
    if (scope.isSiteScoped) {
      // Site supervisor MUST have this exact siteId assigned
      return scope.allowedSiteIds.has(siteIdStr);
    }

    // PM / other roles: check if site is in allowed sites OR parent project is in allowed projects
    if (scope.allowedSiteIds.has(siteIdStr)) return true;
    if (doc.projectId && scope.allowedProjectIds.has(String(doc.projectId))) return true;
    return false;
  }

  // 2. If document only has a projectId (project-level document / BOQ item)
  if (doc.projectId) {
    return scope.allowedProjectIds.has(String(doc.projectId));
  }

  // Unscoped document without project/site references
  return false;
}

/**
 * Asserts document access and throws a strict Forbidden error if caller is unauthorized.
 * Prevents IDOR (Insecure Direct Object Reference) vulnerabilities.
 */
export function assertDocumentAccess(
  scope: UserScope,
  doc: { projectId?: Id<"projects"> | string | null; siteId?: Id<"sites"> | string | null },
  docRef?: string
): void {
  if (!canAccessDocument(scope, doc)) {
    throw new Error(
      `Forbidden: You do not have access to document "${docRef || "item"}" in this project or site.`
    );
  }
}

/**
 * In-memory filter for collections enforcing caller scoping on every row.
 * Use queryScopedByIndex instead for large tables — this is a fallback for
 * small tables (sites, projects, vendors) or tables without compound indexes.
 */
export function filterScopedList<T extends { projectId?: any; siteId?: any }>(
  scope: UserScope,
  items: T[]
): T[] {
  if (scope.isAdmin) return items;
  return items.filter((item) => canAccessDocument(scope, item));
}

/**
 * Index-backed scoped query — replaces collect() → filterScopedList() for large tables.
 *
 * For admins: runs a single unconstrained collect (or status-filtered index query).
 * For site supervisors: runs one by_siteId_status or by_siteId query per allowed site, merges.
 * For PM / procurement officer: runs one by_projectId_status or by_projectId query per
 *   allowed project, merges.
 *
 * Eliminates full-table scans for the primary list queries used on every dashboard page.
 *
 * @param ctx   - Query or mutation context
 * @param table - The Convex table name (must have by_projectId and/or by_siteId indexes)
 * @param scope - Resolved caller scope from resolveCallerScope()
 * @param opts  - Optional status filter applied at the index level where supported
 */
export async function queryScopedByIndex<
  T extends { projectId?: any; siteId?: any; status?: any; _creationTime: number }
>(
  ctx: QueryCtx | MutationCtx,
  table: string,
  scope: UserScope,
  opts: {
    statusFilter?: string;
    hasProjectIdStatusIndex?: boolean; // true if table has by_projectId_status index
    hasSiteIdStatusIndex?: boolean;    // true if table has by_siteId_status index
    hasProjectIdIndex?: boolean;       // true if table has by_projectId index
    hasSiteIdIndex?: boolean;          // true if table has by_siteId index
  } = {}
): Promise<T[]> {
  const {
    statusFilter,
    hasProjectIdStatusIndex = false,
    hasSiteIdStatusIndex = false,
    hasProjectIdIndex = false,
    hasSiteIdIndex = false,
  } = opts;

  const db = ctx.db as any; // Convex typed db — cast needed for dynamic table name

  // Admin: single query — no scoping overhead
  if (scope.isAdmin) {
    if (statusFilter && (hasProjectIdStatusIndex || hasSiteIdStatusIndex)) {
      return await db
        .query(table)
        .withIndex("by_status", (q: any) => q.eq("status", statusFilter))
        .collect();
    }
    return await db.query(table).collect();
  }

  const seen = new Set<string>();
  const results: T[] = [];

  function addUnique(items: T[]) {
    for (const item of items) {
      const id = String(item._creationTime) + JSON.stringify({ p: item.projectId, s: item.siteId });
      // Use _id if available, otherwise fallback to composite key
      const key = (item as any)._id ? String((item as any)._id) : id;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }

  // Site supervisor: query by siteId for each allowed site
  if (scope.isSiteScoped) {
    for (const siteId of scope.allowedSiteIds) {
      let rows: T[];
      if (statusFilter && hasSiteIdStatusIndex) {
        rows = await db
          .query(table)
          .withIndex("by_siteId_status", (q: any) =>
            q.eq("siteId", siteId).eq("status", statusFilter)
          )
          .collect();
      } else if (hasSiteIdIndex) {
        rows = await db
          .query(table)
          .withIndex("by_siteId", (q: any) => q.eq("siteId", siteId))
          .collect();
      } else {
        // Fallback: filter full collect (table has no siteId index)
        rows = (await db.query(table).collect()).filter(
          (r: any) => r.siteId && String(r.siteId) === siteId
        );
      }
      if (statusFilter && !hasSiteIdStatusIndex) {
        rows = rows.filter((r) => r.status === statusFilter);
      }
      addUnique(rows);
    }
    return results;
  }

  // PM / Procurement Officer: query by projectId for each allowed project
  for (const projectId of scope.allowedProjectIds) {
    let rows: T[];
    if (statusFilter && hasProjectIdStatusIndex) {
      rows = await db
        .query(table)
        .withIndex("by_projectId_status", (q: any) =>
          q.eq("projectId", projectId).eq("status", statusFilter)
        )
        .collect();
    } else if (hasProjectIdIndex) {
      rows = await db
        .query(table)
        .withIndex("by_projectId", (q: any) => q.eq("projectId", projectId))
        .collect();
    } else {
      rows = (await db.query(table).collect()).filter(
        (r: any) => r.projectId && String(r.projectId) === projectId
      );
    }
    if (statusFilter && !hasProjectIdStatusIndex) {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    addUnique(rows);
  }

  return results;
}
