/**
 * @fileoverview Sites query endpoints.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * List sites, optionally filtered by projectId.
 */
export const listSites = query({
  args: {
    projectId: v.optional(v.id("projects")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    const sites = args.projectId
      ? await ctx.db
          .query("sites")
          .withIndex("by_projectId_isActive", (q) =>
            q.eq("projectId", args.projectId!).eq("isActive", true)
          )
          .collect()
      : await ctx.db
          .query("sites")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

    return sites.map((s) => ({
      _id: s._id,
      value: s._id,
      label: `${s.name} (${s.code})`,
      name: s.name,
      code: s.code,
      projectId: s.projectId,
      address: s.address,
    }));
  },
});
