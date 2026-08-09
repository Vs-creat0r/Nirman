import { mutation } from "./_generated/server";

export const seedTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const testUsers = [
      {
        name: "DK Supervisor",
        email: "supervisor@nirman.test",
        role: "site_supervisor" as const,
        clerkUserId: "mock_supervisor",
        isActive: true,
      },
      {
        name: "DK Manager",
        email: "manager@nirman.test",
        role: "project_manager" as const,
        clerkUserId: "mock_manager",
        isActive: true,
      },
      {
        name: "DK Procurement",
        email: "procurement@nirman.test",
        role: "procurement_officer" as const,
        clerkUserId: "mock_procurement",
        isActive: true,
      },
      {
        name: "DK Admin",
        email: "admin@nirman.test",
        role: "admin" as const,
        clerkUserId: "mock_admin",
        isActive: true,
      },
    ];

    for (const u of testUsers) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", u.email))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: u.name,
          role: u.role,
          clerkUserId: u.clerkUserId,
        });
      } else {
        await ctx.db.insert("users", u);
      }
    }
    
    return { success: true, message: "Database seeded with 4 role-based test users." };
  },
});
