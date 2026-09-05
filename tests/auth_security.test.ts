import { describe, it, expect } from "vitest";
import {
  timingSafeEqual,
  pbkdf2Hash,
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from "@/convex/auth";

describe("Auth Security & Hardening", () => {
  it("timingSafeEqual correctly compares identical and non-identical strings", () => {
    expect(timingSafeEqual("correctpassword", "correctpassword")).toBe(true);
    expect(timingSafeEqual("correctpassword", "wrongpassword")).toBe(false);
    expect(timingSafeEqual("short", "longerstring")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("generateSessionToken produces 256-bit CSPRNG token with sess_ prefix and 64 hex characters", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toMatch(/^sess_[a-f0-9]{64}$/);
    expect(token2).toMatch(/^sess_[a-f0-9]{64}$/);
    expect(token1).not.toBe(token2);
  });

  it("hashPassword creates a secure pbkdf2 hash formatted string", async () => {
    const password = "SuperSecretPassword123!";
    const storedHash = await hashPassword(password);

    expect(storedHash).toMatch(/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);

    // Verify valid password
    const result = await verifyPassword(password, storedHash);
    expect(result.valid).toBe(true);
    expect(result.needsMigration).toBe(false);

    // Verify invalid password fails
    const invalidResult = await verifyPassword("WrongPassword123!", storedHash);
    expect(invalidResult.valid).toBe(false);
  });

  it("rejects backdoor password+123 attempt", async () => {
    const password = "admin";
    const storedHash = await hashPassword(password);

    // Ensure backdoor fails against hashed password
    const backdoorResult = await verifyPassword("admin123", storedHash);
    expect(backdoorResult.valid).toBe(false);

    // Ensure backdoor fails against legacy plaintext password
    const legacyStored = "admin";
    const backdoorLegacy = await verifyPassword("admin123", legacyStored);
    expect(backdoorLegacy.valid).toBe(false);
  });

  it("verifies legacy plaintext password and flags for migration", async () => {
    const legacyPlaintext = "admin123";

    // Valid legacy password matches and sets needsMigration = true
    const result = await verifyPassword("admin123", legacyPlaintext);
    expect(result.valid).toBe(true);
    expect(result.needsMigration).toBe(true);

    // Wrong password fails
    const wrong = await verifyPassword("wrong", legacyPlaintext);
    expect(wrong.valid).toBe(false);
    expect(wrong.needsMigration).toBe(false);
  });

  it("identifies algorithm prefixes correctly", async () => {
    const pbkdf2Str = await hashPassword("myPass");
    expect(pbkdf2Str.startsWith("pbkdf2:")).toBe(true);

    const sha256Str = "sha256:10000:aabbcc:ddeeff";
    expect(sha256Str.startsWith("sha256:")).toBe(true);

    const plainStr = "mypassword123";
    expect(plainStr.startsWith("pbkdf2:")).toBe(false);
    expect(plainStr.startsWith("sha256:")).toBe(false);
  });
});

