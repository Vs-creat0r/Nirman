/**
 * @fileoverview Master seed script — populates database with demo data.
 * Run once to populate demo data: npx convex run seed:seedAll
 *
 * @module convex/seed
 */
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // ── 0. MIGRATE & DEDUPLICATE USERS ───────────────────────────────────
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      if (!u.username || !u.passwordHash) {
        if (u.role === "admin") {
          await ctx.db.patch(u._id, { username: "admin", passwordHash: "admin123" });
        } else if (u.role === "site_supervisor") {
          await ctx.db.patch(u._id, { username: "supervisor", passwordHash: "supervisor123" });
        } else if (u.role === "project_manager") {
          await ctx.db.patch(u._id, { username: "manager", passwordHash: "manager123" });
        } else if (u.role === "procurement_officer") {
          await ctx.db.patch(u._id, { username: "procurement", passwordHash: "procurement123" });
        }
      }
    }

    // Deduplicate any repeated users by username
    const currentUsers = await ctx.db.query("users").collect();
    const seenUsernames = new Set<string>();
    for (const u of currentUsers) {
      if (u.username) {
        if (seenUsernames.has(u.username)) {
          await ctx.db.delete(u._id);
        } else {
          seenUsernames.add(u.username);
        }
      }
    }

    // ── 1. USERS (4 roles) ──────────────────────────────────────────────
    const admin = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "admin"))
      .first();

    let adminId: Id<"users">;
    if (!admin) {
      adminId = await ctx.db.insert("users", {
        name: "Dev Admin",
        username: "admin",
        passwordHash: "admin123",
        role: "admin",
        isActive: true,
      });
      await ctx.db.patch(adminId, { createdBy: adminId });
    } else {
      adminId = admin._id;
    }

    const otherUserSeeds = [
      {
        name: "Ravi Supervisor",
        username: "supervisor",
        passwordHash: "supervisor123",
        role: "site_supervisor" as const,
      },
      {
        name: "Anil Manager",
        username: "manager",
        passwordHash: "manager123",
        role: "project_manager" as const,
      },
      {
        name: "Priya Procurement",
        username: "procurement",
        passwordHash: "procurement123",
        role: "procurement_officer" as const,
      },
    ];

    for (const u of otherUserSeeds) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", u.username))
        .first();
      if (!existing) {
        await ctx.db.insert("users", {
          ...u,
          isActive: true,
          createdBy: adminId,
        });
      }
    }

    // ── 2. PROJECT ──────────────────────────────────────────────────────
    let projectId = (await ctx.db.query("projects").first())?._id;
    if (!projectId) {
      projectId = await ctx.db.insert("projects", {
        name: "Nirman HQ Tower",
        code: "NHT-001",
        client: "Nirman Infra Pvt Ltd",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2027-06-30",
        createdBy: adminId,
      });
    }

    // ── 3. SITES (2 sites under the project) ────────────────────────────
    const siteSeeds = [
      {
        name: "Site A — Foundation Block",
        code: "NHT-S1",
        address: "Plot 12, Andheri East",
        projectId,
      },
      {
        name: "Site B — Tower Block",
        code: "NHT-S2",
        address: "Plot 14, Andheri East",
        projectId,
      },
    ];
    for (const s of siteSeeds) {
      const existing = await ctx.db
        .query("sites")
        .filter((q) => q.eq(q.field("code"), s.code))
        .first();
      if (!existing) {
        await ctx.db.insert("sites", {
          ...s,
          isActive: true,
          createdBy: adminId,
        });
      }
    }

    // ── 4. VENDORS (5 vendors) ───────────────────────────────────────────
    const vendorSeeds = [
      {
        name: "BuildCore Supplies",
        contactPerson: "Rakesh Shah",
        phone: "9876543210",
        email: "buildcore@vendor.test",
        category: "materials",
      },
      {
        name: "SteelPro India",
        contactPerson: "Meena Patel",
        phone: "9876543211",
        email: "steelpro@vendor.test",
        category: "steel",
      },
      {
        name: "CementMart Pvt Ltd",
        contactPerson: "Arun Verma",
        phone: "9876543212",
        email: "cementmart@vendor.test",
        category: "cement",
      },
      {
        name: "ElectraFit Solutions",
        contactPerson: "Sunita Rao",
        phone: "9876543213",
        email: "electrafit@vendor.test",
        category: "electrical",
      },
      {
        name: "SafeGuard Equipment",
        contactPerson: "Vijay Nair",
        phone: "9876543214",
        email: "safeguard@vendor.test",
        category: "safety",
      },
    ];
    for (const v of vendorSeeds) {
      const existing = await ctx.db
        .query("vendors")
        .filter((q) => q.eq(q.field("email"), v.email))
        .first();
      if (!existing) {
        await ctx.db.insert("vendors", {
          ...v,
          isActive: true,
          createdBy: adminId,
        });
      }
    }

    // ── 5. BOQ ITEMS (20 items) ──────────────────────────────────────────
    const boqItems = [
      { name: "M30 Concrete", unit: "CUM", quantity: 500, category: "Civil Work" },
      { name: "Fe500 Steel Bars 12mm", unit: "MT", quantity: 80, category: "Steel" },
      { name: "OPC Cement 53 Grade", unit: "BAG", quantity: 2000, category: "Cement" },
      { name: "Sand (River)", unit: "CUM", quantity: 300, category: "Civil Work" },
      { name: "Coarse Aggregate 20mm", unit: "CUM", quantity: 400, category: "Civil Work" },
      { name: "AAC Blocks 600x200x150", unit: "NOS", quantity: 5000, category: "Masonry" },
      { name: "Hollow Blocks 400x200x200", unit: "NOS", quantity: 3000, category: "Masonry" },
      { name: "Ceramic Floor Tiles 600x600", unit: "SFT", quantity: 8000, category: "Finishing" },
      { name: "UPVC Windows 1.2x1.2m", unit: "NOS", quantity: 120, category: "Doors & Windows" },
      { name: "Main Door Frames Teak", unit: "NOS", quantity: 40, category: "Doors & Windows" },
      { name: "PVC Conduit Pipe 25mm", unit: "MTR", quantity: 1500, category: "Electrical" },
      { name: "Copper Wire 2.5sq mm", unit: "MTR", quantity: 3000, category: "Electrical" },
      { name: "LED Panel Light 18W", unit: "NOS", quantity: 200, category: "Electrical" },
      { name: "CPVC Pipe 25mm", unit: "MTR", quantity: 800, category: "Plumbing" },
      { name: "Sanitary Fitting Set", unit: "SET", quantity: 30, category: "Plumbing" },
      { name: "Waterproofing Membrane", unit: "SQM", quantity: 600, category: "Waterproofing" },
      { name: "Safety Helmet", unit: "NOS", quantity: 50, category: "Safety" },
      { name: "Safety Harness", unit: "NOS", quantity: 20, category: "Safety" },
      { name: "Paint (Exterior) 20L", unit: "BKT", quantity: 100, category: "Finishing" },
      { name: "Wood Polish Primer 4L", unit: "CAN", quantity: 40, category: "Finishing" },
    ];

    for (const item of boqItems) {
      const existing = await ctx.db
        .query("project_items")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemName"), item.name),
            q.eq(q.field("projectId"), projectId)
          )
        )
        .first();
      if (!existing) {
        await ctx.db.insert("project_items", {
          projectId,
          itemName: item.name,
          category: item.category,
          unit: item.unit,
          boqQty: item.quantity,
          procuredQty: 0,
          committedQty: 0,
          createdBy: adminId,
        });
      }
    }

    // ── 5. COMPANY PROFILE & SETTINGS ─────────────────────────────────
    const existingSettings = await ctx.db.query("settings").first();
    if (!existingSettings) {
      await ctx.db.insert("settings", {
        companyName: "Nirman Construction & Infrastructure Pvt Ltd",
        companyGstNo: "27AABCN1234F1Z5",
        companyBillingAddress:
          "Plot 42, Sector 18, Commercial Hub, Bandra Kurla Complex, Mumbai, Maharashtra - 400051",
        companyContactPerson: "Head of Procurement (Central Office)",
        companyPhone: "+91 22 6789 0123",
        companyEmail: "procurement@nirman.infra",
        requireManagerApprovalForRequests: true,
        updatedAt: new Date().toISOString(),
      });
    }

    // ── 6. DEFAULT TERMS & CONDITIONS TEMPLATES ────────────────────────
    const existingTpl = await ctx.db.query("tc_templates").first();
    if (!existingTpl) {
      await ctx.db.insert("tc_templates", {
        name: "Standard Procurement & Materials T&C",
        content: `1. SPECIFICATION & ACCEPTANCE: All materials supplied must strictly match agreed technical specifications, brand certifications, and test certificates.\n2. DELIVERY & UNLOADING: Material must be delivered to the specified site address during site working hours (8:00 AM - 6:00 PM). Delivery Challan (DC) must accompany all shipments.\n3. REJECTION & REPLACEMENT: Defective, damaged, or non-conforming materials will be rejected at site. Vendor shall arrange replacement within 48 hours at vendor's own cost.\n4. INVOICING & PAYMENT: Commercial invoices must clearly cite this PO Reference Number and GSTIN. Payment shall be released as per agreed commercial credit terms upon verification of Goods Receipt Note (GRN).\n5. JURISDICTION: Any dispute arising under this purchase order is subject to the exclusive jurisdiction of the courts of Mumbai, India.`,
        isDefault: true,
        isActive: true,
        createdBy: adminId,
        updatedBy: adminId,
        updatedAt: new Date().toISOString(),
      });

      await ctx.db.insert("tc_templates", {
        name: "Urgent Ready-Mix Concrete (RMC) & Aggregates Terms",
        content: `1. TIME OF ESSENCE: Pouring schedule must adhere strictly to agreed site delivery slots. Concrete must be poured within 90 minutes of batching.\n2. SLUMP & QUALITY: Slump test & cube test sampling will be conducted at site prior to discharge.\n3. GST & BILLING: Metered cubic meters (cum) billings reconciled against weighbridge / volumetric batch chits.`,
        isDefault: false,
        isActive: true,
        createdBy: adminId,
        updatedBy: adminId,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message:
        "Database seeded: 4 users, 1 project, 2 sites, 5 vendors, 20 BOQ items, Company Profile, and T&C Templates.",
    };
  },
});

