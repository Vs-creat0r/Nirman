import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("site_supervisor"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("admin")
    ),
    isActive: v.boolean(),
    clerkUserId: v.string(),
  })
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_email", ["email"]),
});
