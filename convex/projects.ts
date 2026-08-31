/**
 * @fileoverview Projects query endpoints.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./rbac";

/**
 * List all active projects accessible to the logged-in user.
 */
export const listProjects = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return projects.map((p) => ({
      _id: p._id,
      value: p._id,
      label: `${p.name} (${p.code})`,
      name: p.name,
      code: p.code,
      client: p.client,
    }));
  },
});

/**
 * Get single project by ID.
 */
export const getProject = query({
  args: {
    id: v.id("projects"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    return await ctx.db.get(args.id);
  },
});
