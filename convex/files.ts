/**
 * @fileoverview Convex File Storage backend helpers with document-level authorization.
 *
 * Implements Decision D2 from sprintplan.md:
 * Uses Convex built-in storage (`ctx.storage`) for unloading proof photos & document uploads.
 * Enforces IDOR protection by resolving storage IDs back to their parent documents
 * and checking caller scope authorization.
 */

import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requirePermission } from "./permissions";
import { resolveCallerScope, assertDocumentAccess, UserScope } from "./scoping";

/**
 * Resolves the parent document of a storage ID and asserts caller has access to it.
 */
async function assertFileAccess(
  ctx: QueryCtx,
  scope: UserScope,
  storageId: Id<"_storage">
): Promise<void> {
  if (scope.isAdmin) return;

  // Check GRN records where photos array contains this storage ID
  const allGRNs = await ctx.db.query("grn").collect();
  const parentGRN = allGRNs.find((g) => g.photos && g.photos.includes(storageId));

  if (parentGRN) {
    assertDocumentAccess(scope, parentGRN, parentGRN.refNo);
    return;
  }

  // If not attached to any accessible document, fail-closed
  throw new Error("Forbidden: File is not associated with any document in your authorized scope.");
}

/**
 * Generates an authorized upload URL for client-side direct uploads.
 */
export const generateUploadUrl = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Ensure the user is authenticated with valid role permission
    await requirePermission(ctx, "files:upload", args.token);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolves a storage ID to an accessible URL (requires document-level authorization).
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);
    await assertFileAccess(ctx, scope, args.storageId);

    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Batch resolves multiple storage IDs to their URLs (requires document-level authorization).
 */
export const getFileUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    for (const storageId of args.storageIds) {
      await assertFileAccess(ctx, scope, storageId);
    }

    const urls = await Promise.all(
      args.storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id);
        return url ? { id, url } : null;
      })
    );
    return urls.filter((item): item is { id: typeof args.storageIds[number]; url: string } => item !== null);
  },
});
