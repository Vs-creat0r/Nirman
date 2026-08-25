/**
 * @fileoverview Convex File Storage backend helpers.
 *
 * Implements Decision D2 from sprintplan.md:
 * Uses Convex built-in storage (`ctx.storage`) for unloading proof photos & document uploads.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";

/**
 * Generates an authorized upload URL for client-side direct uploads.
 */
export const generateUploadUrl = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Ensure the user is authenticated with any valid role
    await requireRole(
      ctx,
      ["admin", "project_manager", "procurement_officer", "site_supervisor"],
      args.token
    );

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolves a storage ID to an accessible URL.
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Batch resolves multiple storage IDs to their URLs.
 */
export const getFileUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id);
        return url ? { id, url } : null;
      })
    );
    return urls.filter((item): item is { id: typeof args.storageIds[number]; url: string } => item !== null);
  },
});
