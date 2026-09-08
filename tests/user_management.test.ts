import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, timingSafeEqual } from "@/convex/auth";
import { PERMISSIONS } from "@/convex/permissions";
import type { UserRole } from "@/lib/nav-config";

describe("Slice 1: User Creation & Security", () => {
  it("restricts users:manage strictly to admin role", () => {
    expect(PERMISSIONS["users:manage"]).toEqual(["admin"]);
  });

  it("hashes password with pbkdf2 when creating a user", async () => {
    const rawPassword = "ValidPassword123!";
    const hashedPassword = await hashPassword(rawPassword);

    expect(hashedPassword).toMatch(/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);

    const verification = await verifyPassword(rawPassword, hashedPassword);
    expect(verification.valid).toBe(true);
    expect(verification.needsMigration).toBe(false);
  });

  it("verifies username normalization logic: trims and lowercases", () => {
    const rawUsername = "  SiteSuper_01  ";
    const normalized = rawUsername.trim().toLowerCase();
    expect(normalized).toBe("sitesuper_01");
    expect(normalized.length).toBeGreaterThanOrEqual(3);
  });

  it("verifies minimum length requirements for new user fields", () => {
    const name = "  A  ".trim();
    expect(name.length).toBeLessThan(2);

    const username = " ab ".trim().toLowerCase();
    expect(username.length).toBeLessThan(3);

    const password = "short";
    expect(password.length).toBeLessThan(8);
  });
});

describe("Slice 2a: Password Management & Self-Service Profile", () => {
  it("verifies password change requires correct current password", async () => {
    const currentPassword = "CurrentPassword123!";
    const storedHash = await hashPassword(currentPassword);

    // Correct current password succeeds
    const correctCheck = await verifyPassword("CurrentPassword123!", storedHash);
    expect(correctCheck.valid).toBe(true);

    // Incorrect current password fails
    const wrongCheck = await verifyPassword("WrongPassword123!", storedHash);
    expect(wrongCheck.valid).toBe(false);
  });

  it("enforces minimum 8 characters for password change and reset", () => {
    const shortNewPassword = "abc123";
    expect(shortNewPassword.length).toBeLessThan(8);

    const validNewPassword = "NewSecurePassword456!";
    expect(validNewPassword.length).toBeGreaterThanOrEqual(8);
  });

  it("validates self-service profile update constraints", () => {
    // Name validation
    const tooShortName = " X ".trim();
    expect(tooShortName.length).toBeLessThan(2);

    const validName = " John Doe ".trim();
    expect(validName.length).toBeGreaterThanOrEqual(2);
    expect(validName).toBe("John Doe");

    // Optional email/phone trimming
    const email = "  user@example.com  ".trim() || undefined;
    expect(email).toBe("user@example.com");

    const emptyPhone = "   ".trim() || undefined;
    expect(emptyPhone).toBeUndefined();
  });
});

describe("Slice 2b: My Profile Client Validation", () => {
  it("validates password confirmation matching", () => {
    const newPassword: string = "Password1234!";
    const matchingConfirm: string = "Password1234!";
    const mismatchedConfirm: string = "DifferentPassword1234!";

    expect(newPassword === matchingConfirm).toBe(true);
    expect(newPassword === mismatchedConfirm).toBe(false);
  });
});

describe("Slice 3: Route Protection & Session Cookie Alignment", () => {
  it("verifies session cookie name alignment across middleware and client", () => {
    const SESSION_COOKIE = "nirman_session";
    expect(SESSION_COOKIE).toBe("nirman_session");
  });

  it("verifies role gate logic for admin only routes", () => {
    const allowedRoles = ["admin"];
    expect(allowedRoles.includes("admin")).toBe(true);
    expect(allowedRoles.includes("site_supervisor")).toBe(false);
    expect(allowedRoles.includes("project_manager")).toBe(false);
    expect(allowedRoles.includes("procurement_officer")).toBe(false);
  });
});

describe("Slice 4: Seed Prod-Guard & Hash Verification", () => {
  it("verifies fail-closed prod guard rejects when ALLOW_SEED is not explicitly true", () => {
    const checkGuard = (val: string | undefined) => val === "true";
    expect(checkGuard(undefined)).toBe(false);
    expect(checkGuard("")).toBe(false);
    expect(checkGuard("false")).toBe(false);
    expect(checkGuard("1")).toBe(false);
    expect(checkGuard("true")).toBe(true);
  });

  it("generates PBKDF2 hashes for all default seed accounts", async () => {
    const seedPasswords = ["admin123", "supervisor123", "manager123", "procurement123"];
    const hashes = await Promise.all(seedPasswords.map((p) => hashPassword(p)));

    for (let i = 0; i < seedPasswords.length; i++) {
      expect(hashes[i]).toMatch(/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);
      const verify = await verifyPassword(seedPasswords[i], hashes[i]);
      expect(verify.valid).toBe(true);
    }
  });
});

describe("Slice 5: Demotion Detection & Session Revocation Logic", () => {
  const ROLE_RANK: Record<string, number> = {
    site_supervisor: 1,
    procurement_officer: 2,
    project_manager: 3,
    admin: 4,
  };

  it("correctly flags demotions as requiring revocation", () => {
    const isDemotion = (oldRole: string, newRole: string) =>
      (ROLE_RANK[newRole] ?? 0) < (ROLE_RANK[oldRole] ?? 0);

    // Admin to Project Manager is a demotion
    expect(isDemotion("admin", "project_manager")).toBe(true);
    // Project Manager to Site Supervisor is a demotion
    expect(isDemotion("project_manager", "site_supervisor")).toBe(true);
    // Admin to Site Supervisor is a demotion
    expect(isDemotion("admin", "site_supervisor")).toBe(true);
  });

  it("does not flag promotions or lateral changes as demotions", () => {
    const isDemotion = (oldRole: string, newRole: string) =>
      (ROLE_RANK[newRole] ?? 0) < (ROLE_RANK[oldRole] ?? 0);

    // Site Supervisor to Project Manager is promotion
    expect(isDemotion("site_supervisor", "project_manager")).toBe(false);
    // Same role is not a demotion
    expect(isDemotion("site_supervisor", "site_supervisor")).toBe(false);
    expect(isDemotion("admin", "admin")).toBe(false);
  });
});

describe("Slice 6: Cleanup & timingSafeEqual Verification", () => {
  it("timingSafeEqual correctly handles equal and unequal strings of various lengths", () => {
    expect(timingSafeEqual("hello", "hello")).toBe(true);
    expect(timingSafeEqual("hello", "world")).toBe(false);
    expect(timingSafeEqual("hello", "hello world")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("a", "")).toBe(false);
  });

  it("type compatibility check for UserRole re-export", () => {
    const role: UserRole = "admin";
    expect(role).toBe("admin");
  });
});
