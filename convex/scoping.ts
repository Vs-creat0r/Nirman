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
 * Resolves security scope from an already-authenticated user entity.
 * Shared by resolveCallerScope and mutation cascade helpers.
 */
export async function buildUserScope(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
): Promise<UserScope> {
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

    for (const siteIdStr of rawSiteIds) {
      try {
        const site = await ctx.db.get(siteIdStr as Id<"sites">);
        if (site && "projectId" in site && site.projectId) {
          allowedProjectIds.add(String(site.projectId));
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

  for (const projectId of rawProjectIds) {
    const projectSites = await ctx.db
      .query("sites")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId as Id<"projects">))
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
  return await buildUserScope(ctx, user);
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

export type ScopedTableName =
  | "material_request"
  | "cost_comparison"
  | "purchase_order"
  | "delivery_challan"
  | "project_items"
  | "grn"
  | "inventory"
  | "stock_movements";

interface TableIndexConfig {
  hasProjectIdStatusIndex?: boolean;
  hasSiteIdStatusIndex?: boolean;
  hasProjectIdIndex?: boolean;
  hasSiteIdIndex?: boolean;
  hasStatusIndex?: boolean;
}

/**
 * Compile-time index capabilities derived directly from convex/schema.ts.
 * Prevents typos, eliminates caller boolean flags, and avoids silent full-table scan fallbacks.
 */
const SCHEMA_INDEX_CAPABILITIES: Record<ScopedTableName, TableIndexConfig> = {
  material_request: {
    hasProjectIdIndex: true,
    hasSiteIdStatusIndex: true,
    hasStatusIndex: true,
  },
  cost_comparison: {
    hasProjectIdStatusIndex: true,
    hasStatusIndex: true,
  },
  purchase_order: {
    hasProjectIdStatusIndex: true,
    hasSiteIdStatusIndex: true,
    hasStatusIndex: true,
  },
  delivery_challan: {
    hasSiteIdStatusIndex: true,
    hasStatusIndex: true,
  },
  project_items: {
    hasProjectIdIndex: true,
  },
  grn: {
    hasSiteIdIndex: true,
  },
  inventory: {
    hasProjectIdIndex: true,
    hasSiteIdIndex: true,
  },
  stock_movements: {
    hasProjectIdIndex: true,
    hasSiteIdIndex: true,
  },
};

/**
 * In-memory filter for collections enforcing caller scoping on every row.
 * Use queryScopedByIndex instead for large tables — this is a fallback for
 * small tables (sites, projects, vendors) or tables without compound indexes.
 */
export function filterScopedList<T extends { projectId?: Id<"projects"> | string; siteId?: Id<"sites"> | string }>(
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
 * For site supervisors: runs index queries per allowed site (or allowed parent project), merges.
 * For PM / procurement officer: runs index queries per allowed project (or allowed site), merges.
 *
 * Capabilities are derived from schema — fails fast if an invalid table or unindexed pattern is queried.
 *
 * @param ctx   - Query or mutation context
 * @param table - The Convex table name (strictly typed to ScopedTableName)
 * @param scope - Resolved caller scope from resolveCallerScope()
 * @param opts  - Optional status filter applied at the index level
 */
async function queryTableByIndex<TableName extends ScopedTableName>(
  ctx: QueryCtx | MutationCtx,
  table: TableName,
  filter: {
    status?: string;
    siteId?: string;
    projectId?: string;
  }
): Promise<Doc<TableName>[]> {
  const { status, siteId, projectId } = filter;

  switch (table) {
    case "material_request": {
      if (siteId) {
        if (status) {
          const res = await ctx.db
            .query("material_request")
            .withIndex("by_siteId_status", (q) =>
              q.eq("siteId", siteId as Id<"sites">).eq("status", status as any)
            )
            .collect();
          return res as unknown as Doc<TableName>[];
        }
        const res = await ctx.db
          .query("material_request")
          .withIndex("by_siteId_status", (q) =>
            q.eq("siteId", siteId as Id<"sites">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (projectId) {
        const rows = await ctx.db
          .query("material_request")
          .withIndex("by_projectId", (q) =>
            q.eq("projectId", projectId as Id<"projects">)
          )
          .collect();
        const res = status ? rows.filter((r) => r.status === status) : rows;
        return res as unknown as Doc<TableName>[];
      }
      if (status) {
        const res = await ctx.db
          .query("material_request")
          .withIndex("by_status", (q) => q.eq("status", status as any))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("material_request").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "cost_comparison": {
      if (projectId) {
        if (status) {
          const res = await ctx.db
            .query("cost_comparison")
            .withIndex("by_projectId_status", (q) =>
              q.eq("projectId", projectId as Id<"projects">).eq("status", status as any)
            )
            .collect();
          return res as unknown as Doc<TableName>[];
        }
        const res = await ctx.db
          .query("cost_comparison")
          .withIndex("by_projectId_status", (q) =>
            q.eq("projectId", projectId as Id<"projects">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (status) {
        const res = await ctx.db
          .query("cost_comparison")
          .withIndex("by_status", (q) => q.eq("status", status as any))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("cost_comparison").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "purchase_order": {
      if (projectId) {
        if (status) {
          const res = await ctx.db
            .query("purchase_order")
            .withIndex("by_projectId_status", (q) =>
              q.eq("projectId", projectId as Id<"projects">).eq("status", status as any)
            )
            .collect();
          return res as unknown as Doc<TableName>[];
        }
        const res = await ctx.db
          .query("purchase_order")
          .withIndex("by_projectId_status", (q) =>
            q.eq("projectId", projectId as Id<"projects">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (siteId) {
        if (status) {
          const res = await ctx.db
            .query("purchase_order")
            .withIndex("by_siteId_status", (q) =>
              q.eq("siteId", siteId as Id<"sites">).eq("status", status as any)
            )
            .collect();
          return res as unknown as Doc<TableName>[];
        }
        const res = await ctx.db
          .query("purchase_order")
          .withIndex("by_siteId_status", (q) =>
            q.eq("siteId", siteId as Id<"sites">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (status) {
        const res = await ctx.db
          .query("purchase_order")
          .withIndex("by_status", (q) => q.eq("status", status as any))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("purchase_order").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "delivery_challan": {
      if (siteId) {
        if (status) {
          const res = await ctx.db
            .query("delivery_challan")
            .withIndex("by_siteId_status", (q) =>
              q.eq("siteId", siteId as Id<"sites">).eq("status", status as any)
            )
            .collect();
          return res as unknown as Doc<TableName>[];
        }
        const res = await ctx.db
          .query("delivery_challan")
          .withIndex("by_siteId_status", (q) =>
            q.eq("siteId", siteId as Id<"sites">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (status) {
        const res = await ctx.db
          .query("delivery_challan")
          .withIndex("by_status", (q) => q.eq("status", status as any))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("delivery_challan").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "project_items": {
      if (projectId) {
        const res = await ctx.db
          .query("project_items")
          .withIndex("by_projectId", (q) =>
            q.eq("projectId", projectId as Id<"projects">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("project_items").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "grn": {
      if (siteId) {
        const res = await ctx.db
          .query("grn")
          .withIndex("by_siteId", (q) =>
            q.eq("siteId", siteId as Id<"sites">)
          )
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("grn").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "inventory": {
      if (siteId) {
        const res = await ctx.db
          .query("inventory")
          .withIndex("by_siteId", (q) => q.eq("siteId", siteId as Id<"sites">))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (projectId) {
        const res = await ctx.db
          .query("inventory")
          .withIndex("by_projectId", (q) => q.eq("projectId", projectId as Id<"projects">))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("inventory").collect();
      return res as unknown as Doc<TableName>[];
    }

    case "stock_movements": {
      if (siteId) {
        const res = await ctx.db
          .query("stock_movements")
          .withIndex("by_siteId_itemName", (q) => q.eq("siteId", siteId as Id<"sites">))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      if (projectId) {
        const res = await ctx.db
          .query("stock_movements")
          .withIndex("by_projectId", (q) => q.eq("projectId", projectId as Id<"projects">))
          .collect();
        return res as unknown as Doc<TableName>[];
      }
      const res = await ctx.db.query("stock_movements").collect();
      return res as unknown as Doc<TableName>[];
    }
  }
}

/**
 * Index-backed scoped query — replaces collect() → filterScopedList() for large tables.
 *
 * For admins: runs a single unconstrained collect (or status-filtered index query).
 * For site supervisors: runs index queries per allowed site (or allowed parent project), merges.
 * For PM / procurement officer: runs index queries per allowed project (or allowed site), merges.
 *
 * Capabilities are derived from schema — fails fast if an invalid table or unindexed pattern is queried.
 *
 * @param ctx   - Query or mutation context
 * @param table - The Convex table name (strictly typed to ScopedTableName)
 * @param scope - Resolved caller scope from resolveCallerScope()
 * @param opts  - Optional status filter applied at the index level
 */
export async function queryScopedByIndex<TableName extends ScopedTableName>(
  ctx: QueryCtx | MutationCtx,
  table: TableName,
  scope: UserScope,
  opts: {
    statusFilter?: string;
    siteId?: string | Id<"sites">;
    projectId?: string | Id<"projects">;
  } = {}
): Promise<Doc<TableName>[]> {
  const indexCaps = SCHEMA_INDEX_CAPABILITIES[table];
  if (!indexCaps) {
    throw new Error(`Table "${table}" is not configured for index-backed scoping.`);
  }

  const { statusFilter } = opts;
  const targetSiteId = opts.siteId ? String(opts.siteId) : undefined;
  const targetProjectId = opts.projectId ? String(opts.projectId) : undefined;

  // Admin: single query — no scoping overhead
  if (scope.isAdmin) {
    return await queryTableByIndex(ctx, table, {
      status: statusFilter,
      siteId: targetSiteId,
      projectId: targetProjectId,
    });
  }

  const seen = new Set<string>();
  const results: Doc<TableName>[] = [];

  function addUnique(items: Doc<TableName>[]) {
    for (const item of items) {
      const key = String(item._id);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }

  // Specific site requested
  if (targetSiteId) {
    if (scope.allowedSiteIds.has(targetSiteId)) {
      const rows = await queryTableByIndex(ctx, table, { siteId: targetSiteId, status: statusFilter });
      addUnique(rows);
    }
    return results;
  }

  // Specific project requested
  if (targetProjectId) {
    if (scope.allowedProjectIds.has(targetProjectId)) {
      const rows = await queryTableByIndex(ctx, table, { projectId: targetProjectId, status: statusFilter });
      addUnique(rows);
    }
    return results;
  }

  // Site supervisor: query by siteId for each allowed site
  if (scope.isSiteScoped) {
    for (const siteId of scope.allowedSiteIds) {
      if (indexCaps.hasSiteIdStatusIndex || indexCaps.hasSiteIdIndex) {
        const rows = await queryTableByIndex(ctx, table, { siteId, status: statusFilter });
        addUnique(rows);
      } else if (indexCaps.hasProjectIdIndex || indexCaps.hasProjectIdStatusIndex) {
        for (const projectId of scope.allowedProjectIds) {
          const pRows = await queryTableByIndex(ctx, table, { projectId, status: statusFilter });
          addUnique(pRows);
        }
      } else {
        throw new Error(
          `Security invariant violation: Scoped table "${table}" lacks site and project indexes for site supervisor access.`
        );
      }
    }
    return results;
  }

  // PM / Procurement Officer: query by projectId (or siteId for site-partitioned tables)
  if (indexCaps.hasProjectIdStatusIndex || indexCaps.hasProjectIdIndex) {
    for (const projectId of scope.allowedProjectIds) {
      const rows = await queryTableByIndex(ctx, table, { projectId, status: statusFilter });
      addUnique(rows);
    }
    return results;
  }

  if (indexCaps.hasSiteIdStatusIndex || indexCaps.hasSiteIdIndex) {
    for (const siteId of scope.allowedSiteIds) {
      const sRows = await queryTableByIndex(ctx, table, { siteId, status: statusFilter });
      addUnique(sRows);
    }
    return results;
  }

  throw new Error(
    `Security invariant violation: Scoped table "${table}" lacks project and site indexes for manager access.`
  );
}
