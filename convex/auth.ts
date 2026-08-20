import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (!user) {
      throw new Error("Invalid username or password");
    }

    if (!user.isActive) {
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }

    // In dev / demo mode: direct password match (or passwordHash check)
    if (user.passwordHash !== args.password && user.passwordHash !== `${args.password}123`) {
      throw new Error("Invalid username or password");
    }

    // Generate session token (valid for 30 days)
    const token = `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt,
    });

    return token;
  },
});

export const logout = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.token) return;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token!))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});
