import { describe, it, expect } from "vitest";
import { PERMISSIONS, UserRole } from "../convex/permissions";

describe("Projects and Sites Authorization & Master Data Constraints", () => {
  it("restricts projects:manage strictly to admin role", () => {
    expect(PERMISSIONS["projects:manage"]).toEqual(["admin"]);
  });

  it("restricts sites:manage strictly to admin role", () => {
    expect(PERMISSIONS["sites:manage"]).toEqual(["admin"]);
  });

  it("restricts users:manage strictly to admin role", () => {
    expect(PERMISSIONS["users:manage"]).toEqual(["admin"]);
  });

  it("restricts users:change_role strictly to admin role", () => {
    expect(PERMISSIONS["users:change_role"]).toEqual(["admin"]);
  });

  it("verifies project code format regex matches uppercase alphanumeric codes", () => {
    const codeRegex = /^[A-Z0-9\-]{2,20}$/;
    expect(codeRegex.test("PRJ-2026")).toBe(true);
    expect(codeRegex.test("METRO-L1")).toBe(true);
    expect(codeRegex.test("A1")).toBe(true);
    expect(codeRegex.test("p")).toBe(false); // lowercase
    expect(codeRegex.test("PRJ_2026")).toBe(false); // underscore
    expect(codeRegex.test("")).toBe(false); // empty
  });

  it("verifies site code format regex matches uppercase codes", () => {
    const codeRegex = /^[A-Z0-9\-]{1,12}$/;
    expect(codeRegex.test("S-01")).toBe(true);
    expect(codeRegex.test("NORTH")).toBe(true);
    expect(codeRegex.test("1")).toBe(true);
    expect(codeRegex.test("site_1")).toBe(false); // lowercase and underscore
  });
});
