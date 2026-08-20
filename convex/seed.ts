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
    // ── 1. USERS (4 roles) ──────────────────────────────────────────────
    let admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
      .unique();

    let adminId: Id<"users">;
    if (!admin) {
      adminId = await ctx.db.insert("users", {
        name: "Dev Admin",
        email: "admin@example.com",
        role: "admin",
        isActive: true,
        authAccountId: "mock_admin",
      });
      await ctx.db.patch(adminId, { createdBy: adminId });
    } else {
      adminId = admin._id;
    }

    const otherUserSeeds = [
      {
        name: "Ravi Supervisor",
        email: "supervisor@example.com",
        role: "site_supervisor" as const,
        authAccountId: "mock_supervisor",
      },
      {
        name: "Anil Manager",
        email: "manager@example.com",
        role: "project_manager" as const,
        authAccountId: "mock_manager",
      },
      {
        name: "Priya Procurement",
        email: "procurement@example.com",
        role: "procurement_officer" as const,
        authAccountId: "mock_procurement",
      },
    ];

    for (const u of otherUserSeeds) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", u.email))
        .unique();
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
          createdBy: adminId,
        });
      }
    }

    return {
      success: true,
      message:
        "Database seeded: 4 users, 1 project, 2 sites, 5 vendors, 20 BOQ items.",
    };
  },
});
