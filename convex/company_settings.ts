/**
 * @fileoverview Company Profile and Global Settings operations.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./permissions";
import { getCurrentUser } from "./rbac";

/**
 * Get Company Profile details for PO printing and document issuance.
 * Available to all authenticated users.
 */
export const getCompanyProfile = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    const settingsDoc = await ctx.db.query("settings").first();

    return {
      companyName: settingsDoc?.companyName || "Nirman Construction & Infra Pvt Ltd",
      companyGstNo: settingsDoc?.companyGstNo || "27AABCN1234F1Z5",
      companyBillingAddress:
        settingsDoc?.companyBillingAddress ||
        "Plot 42, Sector 18, Commercial Hub, Mumbai, Maharashtra - 400001",
      companyContactPerson: settingsDoc?.companyContactPerson || "Head of Procurement",
      companyPhone: settingsDoc?.companyPhone || "+91 98765 43210",
      companyEmail: settingsDoc?.companyEmail || "procurement@nirman.infra",
      requireManagerApprovalForRequests:
        settingsDoc?.requireManagerApprovalForRequests ?? true,
    };
  },
});

/**
 * Update Company Profile & Settings (Admin only).
 */
export const updateCompanyProfile = mutation({
  args: {
    companyName: v.string(),
    companyGstNo: v.string(),
    companyBillingAddress: v.string(),
    companyContactPerson: v.string(),
    companyPhone: v.string(),
    companyEmail: v.string(),
    requireManagerApprovalForRequests: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "settings:manage", args.token);

    const settingsDoc = await ctx.db.query("settings").first();
    const now = new Date().toISOString();

    if (settingsDoc) {
      await ctx.db.patch(settingsDoc._id, {
        companyName: args.companyName.trim(),
        companyGstNo: args.companyGstNo.trim(),
        companyBillingAddress: args.companyBillingAddress.trim(),
        companyContactPerson: args.companyContactPerson.trim(),
        companyPhone: args.companyPhone.trim(),
        companyEmail: args.companyEmail.trim(),
        requireManagerApprovalForRequests:
          args.requireManagerApprovalForRequests !== undefined
            ? args.requireManagerApprovalForRequests
            : settingsDoc.requireManagerApprovalForRequests,
        updatedAt: now,
      });
      return settingsDoc._id;
    } else {
      const id = await ctx.db.insert("settings", {
        companyName: args.companyName.trim(),
        companyGstNo: args.companyGstNo.trim(),
        companyBillingAddress: args.companyBillingAddress.trim(),
        companyContactPerson: args.companyContactPerson.trim(),
        companyPhone: args.companyPhone.trim(),
        companyEmail: args.companyEmail.trim(),
        requireManagerApprovalForRequests:
          args.requireManagerApprovalForRequests ?? true,
        updatedAt: now,
      });
      return id;
    }
  },
});
