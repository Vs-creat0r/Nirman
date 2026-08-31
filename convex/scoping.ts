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

    // Resolve parent project IDs for the supervisor's assigned sites
    if (rawSiteIds.length > 0) {
      const allSites = await ctx.db.query("sites").collect();
      for (const site of allSites) {
        if (allowedSiteIds.has(String(site._id))) {
          allowedProjectIds.add(String(site.projectId));
        }
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

  if (rawProjectIds.length > 0) {
    const allSites = await ctx.db.query("sites").collect();
    for (const site of allSites) {
      if (allowedProjectIds.has(String(site.projectId))) {
        allowedSiteIds.add(String(site._id));
      }
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
 * (Note: S1-10 will supplement with indexed compound queries for large datasets).
 */
export function filterScopedList<T extends { projectId?: any; siteId?: any }>(
  scope: UserScope,
  items: T[]
): T[] {
  if (scope.isAdmin) return items;
  return items.filter((item) => canAccessDocument(scope, item));
}
