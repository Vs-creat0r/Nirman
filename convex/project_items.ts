/**
 * @fileoverview BOQ / Project items query endpoints.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * List BOQ items for a project.
 */
export const listProjectItems = query({
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

    let itemsQuery = ctx.db.query("project_items");

    if (args.projectId) {
      itemsQuery = itemsQuery.filter((q) => q.eq(q.field("projectId"), args.projectId));
    }

    const items = await itemsQuery.collect();

    return items.map((item) => ({
      _id: item._id,
      value: item._id,
      label: `${item.itemName} (${item.unit})`,
      name: item.itemName,
      unit: item.unit,
      category: item.category,
      boqQty: item.boqQty,
      procuredQty: item.procuredQty,
    }));
  },
});
