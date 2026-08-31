/**
 * @fileoverview Vendor master data management.
 *
 * Provides queries and mutations for managing suppliers/vendors.
 * Name uniqueness is strictly enforced on the server.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";
import { resolveCallerScope, filterScopedList } from "./scoping";

/**
 * List all vendors. Active vendors first, sorted alphabetically by name.
 */
export const listVendors = query({
  args: {
    includeInactive: v.optional(v.boolean()),
    category: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    let vendors = await ctx.db.query("vendors").collect();

    if (!args.includeInactive) {
      vendors = vendors.filter((v) => v.isActive);
    }

    if (args.category) {
      vendors = vendors.filter((v) => v.category === args.category);
    }

    // Sort alphabetically by name
    vendors.sort((a, b) => a.name.localeCompare(b.name));

    return vendors;
  },
});

/**
 * List all vendors with aggregated metrics (scoped by caller's allowed projects).
 */
export const listVendorsWithStats = query({
  args: {
    includeInactive: v.optional(v.boolean()),
    category: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    let vendors = await ctx.db.query("vendors").collect();

    if (!args.includeInactive) {
      vendors = vendors.filter((v) => v.isActive);
    }

    if (args.category) {
      vendors = vendors.filter((v) => v.category === args.category);
    }

    // Sort alphabetically by name
    vendors.sort((a, b) => a.name.localeCompare(b.name));

    // Fetch all POs to aggregate spend (scoped to caller's allowed projects)
    const rawAllPOs = await ctx.db.query("purchase_order").collect();
    const allPOs = filterScopedList(scope, rawAllPOs);

    return vendors.map((v) => {
      const vendorPOs = allPOs.filter((po) => po.vendorId === v._id);
      const approvedPOs = vendorPOs.filter((po) => po.status === "approved");
      const totalSpend = approvedPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0);

      return {
        ...v,
        poCount: vendorPOs.length,
        approvedPOCount: approvedPOs.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
      };
    });
  },
});

/**
 * Get a single vendor by ID with full history (issued POs).
 */
export const getVendorDetails = query({
  args: {
    id: v.id("vendors"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveCallerScope(ctx, args.token);

    const vendor = await ctx.db.get(args.id);
    if (!vendor) return null;

    const allPos = await ctx.db
      .query("purchase_order")
      .withIndex("by_vendorId", (q) => q.eq("vendorId", args.id))
      .collect();

    // Scope POs to caller's allowed projects/sites to prevent cross-project spend leakage
    const pos = filterScopedList(scope, allPos);

    pos.sort((a, b) => b._creationTime - a._creationTime);

    const approvedPOs = pos.filter((po) => po.status === "approved");
    const totalSpend = approvedPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0);

    return {
      ...vendor,
      pos,
      poCount: pos.length,
      approvedPOCount: approvedPOs.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
    };
  },
});

/**
 * Get a single vendor by ID.
 */
export const getVendor = query({
  args: {
    id: v.id("vendors"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    return await ctx.db.get(args.id);
  },
});


/**
 * Create a new vendor with strict server-side name uniqueness check.
 */
export const createVendor = mutation({
  args: {
    name: v.string(),
    contactPerson: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    gstNo: v.optional(v.string()),
    address: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "vendors:create",
      args.token
    );

    const trimmedName = args.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("Vendor name must be at least 2 characters.");
    }

    // Check case-insensitive name uniqueness
    const allVendors = await ctx.db.query("vendors").collect();
    const duplicate = allVendors.find(
      (ven) => ven.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(`A vendor named "${trimmedName}" already exists.`);
    }

    const now = new Date().toISOString();
    const vendorId = await ctx.db.insert("vendors", {
      name: trimmedName,
      contactPerson: args.contactPerson?.trim() || undefined,
      phone: args.phone.trim(),
      email: args.email?.trim() || undefined,
      gstNo: args.gstNo?.trim() || undefined,
      address: args.address?.trim() || undefined,
      category: args.category || undefined,
      isActive: args.isActive !== undefined ? args.isActive : true,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    });

    // Write audit log
    await ctx.db.insert("logs", {
      actorId: user._id,
      actorRole: user.role,
      action: "create_vendor",
      documentType: "vendors",
      documentId: vendorId,
      referenceId: trimmedName,
      timestamp: now,
      note: `Created vendor: ${trimmedName}`,
    });

    return vendorId;
  },
});

/**
 * Update an existing vendor. Re-checks name uniqueness if name was modified.
 */
export const updateVendor = mutation({
  args: {
    id: v.id("vendors"),
    name: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gstNo: v.optional(v.string()),
    address: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "vendors:update",
      args.token
    );

    const existingVendor = await ctx.db.get(args.id);
    if (!existingVendor) {
      throw new Error("Vendor not found.");
    }

    const patch: Record<string, unknown> = {
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length < 2) {
        throw new Error("Vendor name must be at least 2 characters.");
      }

      // Check case-insensitive uniqueness against other vendors
      const allVendors = await ctx.db.query("vendors").collect();
      const duplicate = allVendors.find(
        (ven) =>
          ven._id !== args.id &&
          ven.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicate) {
        throw new Error(`A vendor named "${trimmedName}" already exists.`);
      }
      patch.name = trimmedName;
    }

    if (args.contactPerson !== undefined) patch.contactPerson = args.contactPerson.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.gstNo !== undefined) patch.gstNo = args.gstNo.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.category !== undefined) patch.category = args.category || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);

    return args.id;
  },
});

/**
 * Deactivate a vendor.
 */
export const deactivateVendor = mutation({
  args: {
    id: v.id("vendors"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx,
      "vendors:deactivate",
      args.token
    );

    const vendor = await ctx.db.get(args.id);
    if (!vendor) {
      throw new Error("Vendor not found.");
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
});
