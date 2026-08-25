import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./rbac";
import { QueryCtx } from "./_generated/server";

export async function getUserFromToken(ctx: QueryCtx, token?: string) {
  if (!token) return null;
  
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
    
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  
  return await ctx.db.get(session.userId);
}

export const getMyUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },
});

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const me = await getUserFromToken(ctx, args.token);
    if (!me) throw new Error("Unauthenticated");
    
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.map(({ passwordHash, ...safeUser }) => safeUser);
  },
});

export const testAdminOnly = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"], args.token);
    return { success: true, message: "You are an admin!" };
  },
});
