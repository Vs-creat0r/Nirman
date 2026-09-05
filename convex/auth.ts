import { query, action, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { resolveCallerScope } from "./scoping";

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let diff = 1;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function pbkdf2Hash(password: string, saltHex: string, iterations = 100000): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const saltHex = Array.from(saltBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  try {
    const hashHex = await pbkdf2Hash(password, saltHex, 100000);
    return `pbkdf2:100000:${saltHex}:${hashHex}`;
  } catch {
    const enc = new TextEncoder();
    let current = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(saltHex + password)));
    for (let i = 0; i < 10000; i++) {
      current = new Uint8Array(await crypto.subtle.digest("SHA-256", current));
    }
    const hashHex = Array.from(current, (b) => b.toString(16).padStart(2, "0")).join("");
    return `sha256:10000:${saltHex}:${hashHex}`;
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsMigration: boolean }> {
  if (storedHash.startsWith("pbkdf2:")) {
    const [, iterStr, saltHex, expectedHashHex] = storedHash.split(":");
    const iterations = parseInt(iterStr, 10) || 100000;
    try {
      const computedHash = await pbkdf2Hash(password, saltHex, iterations);
      return { valid: timingSafeEqual(computedHash, expectedHashHex), needsMigration: false };
    } catch {
      return { valid: false, needsMigration: false };
    }
  }

  if (storedHash.startsWith("sha256:")) {
    const [, iterStr, saltHex, expectedHashHex] = storedHash.split(":");
    const iterations = parseInt(iterStr, 10) || 10000;
    const enc = new TextEncoder();
    let current = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(saltHex + password)));
    for (let i = 0; i < iterations; i++) {
      current = new Uint8Array(await crypto.subtle.digest("SHA-256", current));
    }
    const computedHash = Array.from(current, (b) => b.toString(16).padStart(2, "0")).join("");
    return { valid: timingSafeEqual(computedHash, expectedHashHex), needsMigration: true };
  }

  // Legacy plaintext comparison
  const isMatch = timingSafeEqual(password, storedHash);
  return { valid: isMatch, needsMigration: isMatch };
}

export function generateSessionToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const tokenHex = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `sess_${tokenHex}`;
}

export const getUserForAuth = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

export const persistSessionAndMigrate = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    newPasswordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.token,
      expiresAt: args.expiresAt,
    });

    if (args.newPasswordHash) {
      await ctx.db.patch(args.userId, {
        passwordHash: args.newPasswordHash,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

export const login = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const username = args.username.trim().toLowerCase();
    const user = (await ctx.runQuery(internal.auth.getUserForAuth, { username })) as Doc<"users"> | null;

    if (!user) {
      throw new Error("Invalid username or password");
    }

    if (!user.isActive) {
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }

    if (!user.passwordHash) {
      throw new Error("Invalid username or password");
    }

    const { valid, needsMigration } = await verifyPassword(args.password, user.passwordHash);

    if (!valid) {
      throw new Error("Invalid username or password");
    }

    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    let newPasswordHash: string | undefined;
    if (needsMigration) {
      newPasswordHash = await hashPassword(args.password);
    }

    await ctx.runMutation(internal.auth.persistSessionAndMigrate, {
      userId: user._id,
      token,
      expiresAt,
      newPasswordHash,
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

export const hashAlgoForUser = query({
  args: {
    token: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args): Promise<"pbkdf2" | "sha256" | "plaintext" | "not_found"> => {
    const scope = await resolveCallerScope(ctx, args.token);
    if (!scope.isAdmin) {
      throw new Error("Unauthorized: Admin privileges required");
    }

    const username = args.username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (!user || !user.passwordHash) {
      return "not_found";
    }

    if (user.passwordHash.startsWith("pbkdf2:")) {
      return "pbkdf2";
    }
    if (user.passwordHash.startsWith("sha256:")) {
      return "sha256";
    }
    return "plaintext";
  },
});

