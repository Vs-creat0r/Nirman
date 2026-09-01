/**
 * @fileoverview Transition Matrix & Gate 3 Multi-line Scanner Test Suite.
 *
 * Implements S1-07 and 🔴 GATE 3 invariant:
 * 1. Static scanner: Asserts ZERO direct `db.patch` calls touch `status` outside `transition.ts`.
 *    Uses multi-line lookahead inspection to catch formatted patch objects.
 * 2. Dynamic transition validation: Asserts legal and illegal state transitions across lifecycles.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CONVEX_DIR = path.resolve(__dirname, "../convex");

/**
 * Multi-line scanner that inspects every `db.patch` call in a file and returns
 * any line numbers where `status` is modified inside the patch payload.
 */
function findDirectStatusPatches(filePath: string): Array<{ line: number; snippet: string }> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Array<{ line: number; snippet: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("db.patch(")) {
      // Collect lines until closing parenthesis of the db.patch call
      let patchBody = "";
      let j = i;
      while (j < lines.length && j < i + 15) {
        patchBody += lines[j] + "\n";
        if (lines[j].includes("});") || lines[j].includes("})")) {
          break;
        }
        j++;
      }

      // Check if `status:` is a key within this patch payload
      if (/\bstatus\s*:/i.test(patchBody)) {
        violations.push({
          line: i + 1,
          snippet: lines.slice(i, i + 3).map((l) => l.trim()).join(" "),
        });
      }
    }
  }

  return violations;
}

describe("🔴 GATE 3 — Zero Status Writes Outside transition.ts", () => {
  const allConvexFiles = fs
    .readdirSync(CONVEX_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .filter((f) => f !== "transition.ts" && f !== "seed.ts");

  it("statically proves that no convex module modifies document status via raw db.patch", () => {
    const allViolations: Array<{ file: string; line: number; snippet: string }> = [];

    for (const file of allConvexFiles) {
      const fullPath = path.join(CONVEX_DIR, file);
      const violations = findDirectStatusPatches(fullPath);
      for (const v of violations) {
        allViolations.push({
          file: `convex/${file}`,
          line: v.line,
          snippet: v.snippet,
        });
      }
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map((v) => `  - ${v.file}:${v.line} → ${v.snippet}`)
        .join("\n");
      expect.fail(
        `🔴 GATE 3 VIOLATION: Found ${allViolations.length} direct db.patch status writes outside transition.ts:\n${formatted}\n\nAll status transitions MUST route through transition() with explicit from-guards.`
      );
    }

    expect(allViolations).toHaveLength(0);
  });
});

/**
 * Multi-line scanner that inspects every `db.patch` and direct `db.insert` call
 * in convex files and returns any violations where `inventory.quantity` or `stock_movements`
 * are modified outside `movements.ts`.
 */
function findDirectQuantityWrites(filePath: string): Array<{ line: number; snippet: string }> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Array<{ line: number; snippet: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check direct insert into stock_movements or inventory
    if (
      line.includes('db.insert("stock_movements"') ||
      line.includes("db.insert('stock_movements')") ||
      line.includes('db.insert("inventory"') ||
      line.includes("db.insert('inventory')")
    ) {
      violations.push({
        line: i + 1,
        snippet: line.trim(),
      });
      continue;
    }

    if (line.includes("db.patch(")) {
      let patchBody = "";
      let j = i;
      while (j < lines.length && j < i + 15) {
        patchBody += lines[j] + "\n";
        if (lines[j].includes("});") || lines[j].includes("})")) {
          break;
        }
        j++;
      }

      // Check if `quantity:` is modified in this patch payload
      if (/\bquantity\s*:/i.test(patchBody)) {
        violations.push({
          line: i + 1,
          snippet: lines.slice(i, i + 3).map((l) => l.trim()).join(" "),
        });
      }
    }
  }

  return violations;
}

describe("🔴 GATE 1 — Zero Quantity Writes Outside movements.ts", () => {
  const allConvexFiles = fs
    .readdirSync(CONVEX_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .filter((f) => f !== "movements.ts" && f !== "seed.ts");

  it("statically proves that no convex module modifies physical inventory quantity or stock_movements outside movements.ts", () => {
    const allViolations: Array<{ file: string; line: number; snippet: string }> = [];

    for (const file of allConvexFiles) {
      const fullPath = path.join(CONVEX_DIR, file);
      const violations = findDirectQuantityWrites(fullPath);
      for (const v of violations) {
        allViolations.push({
          file: `convex/${file}`,
          line: v.line,
          snippet: v.snippet,
        });
      }
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map((v) => `  - ${v.file}:${v.line} → ${v.snippet}`)
        .join("\n");
      expect.fail(
        `🔴 GATE 1 VIOLATION: Found ${allViolations.length} direct quantity/movement writes outside movements.ts:\n${formatted}\n\nAll physical stock quantity changes MUST route through postMovement().`
      );
    }

    expect(allViolations).toHaveLength(0);
  });
});

describe("State Machine Transition Matrix & Guard Validation", () => {
  // Import transition function dynamically or test its invariant logic
  it("rejects illegal transitions when current status does not match from guard", async () => {
    // Transition engine throws when doc.status is not in `from`
    const { transition } = await import("../convex/transition");

    const mockAdmin = {
      _id: "user_admin_123" as any,
      role: "admin",
      isActive: true,
    };
    const mockSession = {
      _id: "sess_123" as any,
      userId: mockAdmin._id,
      token: "valid_admin_token",
      expiresAt: Date.now() + 100000,
    };

    const mockDoc = {
      _id: "mr_123" as any,
      refNo: "MR-TEST-01",
      status: "draft", // MR is currently draft
      projectId: "proj_123" as any,
      siteId: "site_123" as any,
    };

    const logs: any[] = [];
    const mockCtx: any = {
      db: {
        get: async (id: any) => {
          if (id === mockSession.userId) return mockAdmin;
          if (id === mockDoc._id) return mockDoc;
          return null;
        },
        patch: async (id: any, data: any) => {
          Object.assign(mockDoc, data);
        },
        insert: async (table: string, data: any) => {
          if (table === "logs") logs.push(data);
          return "log_123";
        },
        query: (table: string) => ({
          withIndex: (index: string, filterFn: any) => ({
            first: async () => {
              if (table === "sessions") return mockSession;
              return null;
            },
            unique: async () => {
              if (table === "sessions") return mockSession;
              return null;
            },
            collect: async () => [],
          }),
        }),
      },
    };

    // Attempt illegal transition: draft -> ready_for_po (requires from: "review_cc")
    await expect(
      transition(mockCtx, {
        table: "material_request",
        documentId: mockDoc._id,
        from: "review_cc",
        to: "ready_for_po",
        action: "material_requests:advance_on_cc_approval",
        token: "valid_admin_token",
      })
    ).rejects.toThrow(/Invalid status transition on material_request/i);

    // Attempt legal transition: draft -> pending
    const res = await transition(mockCtx, {
      table: "material_request",
      documentId: mockDoc._id,
      from: "draft",
      to: "pending",
      action: "material_requests:submit",
      token: "valid_admin_token",
    });

    expect(res.success).toBe(true);
    expect(res.documentId).toBe(mockDoc._id);
    expect(res.toStatus).toBe("pending");
    expect(mockDoc.status).toBe("pending");
    expect(logs).toHaveLength(1);
    expect(logs[0].fromStatus).toBe("draft");
    expect(logs[0].toStatus).toBe("pending");
    expect(logs[0].documentType).toBe("material_request");
  });

  it("validates full CC, PO, and DC lifecycle transitions with proper audit logs", async () => {
    const { transition } = await import("../convex/transition");

    const mockAdmin = {
      _id: "user_admin_456" as any,
      role: "admin",
      isActive: true,
    };
    const mockSession = {
      _id: "sess_456" as any,
      userId: mockAdmin._id,
      token: "valid_admin_token_2",
      expiresAt: Date.now() + 100000,
    };

    const mockPO = {
      _id: "po_456" as any,
      refNo: "PO-TEST-01",
      status: "draft",
      projectId: "proj_456" as any,
      siteId: "site_456" as any,
    };

    const mockDC = {
      _id: "dc_456" as any,
      refNo: "DC-TEST-01",
      status: "delivery_processing",
      projectId: "proj_456" as any,
      siteId: "site_456" as any,
    };

    const logs: any[] = [];
    const mockCtx: any = {
      db: {
        get: async (id: any) => {
          if (id === mockSession.userId) return mockAdmin;
          if (id === mockPO._id) return mockPO;
          if (id === mockDC._id) return mockDC;
          return null;
        },
        patch: async (id: any, data: any) => {
          if (id === mockPO._id) Object.assign(mockPO, data);
          if (id === mockDC._id) Object.assign(mockDC, data);
        },
        insert: async (table: string, data: any) => {
          if (table === "logs") logs.push(data);
          return "log_456";
        },
        query: (table: string) => ({
          withIndex: (index: string, filterFn: any) => ({
            first: async () => mockSession,
            unique: async () => mockSession,
            collect: async () => [],
          }),
        }),
      },
    };

    // PO: draft -> submitted
    await transition(mockCtx, {
      table: "purchase_order",
      documentId: mockPO._id,
      from: "draft",
      to: "submitted",
      action: "purchase_orders:submit",
      token: "valid_admin_token_2",
    });
    expect(mockPO.status).toBe("submitted");

    // PO: submitted -> approved
    await transition(mockCtx, {
      table: "purchase_order",
      documentId: mockPO._id,
      from: "submitted",
      to: "approved",
      action: "purchase_orders:approve",
      token: "valid_admin_token_2",
    });
    expect(mockPO.status).toBe("approved");

    // DC: delivery_processing -> delivered
    await transition(mockCtx, {
      table: "delivery_challan",
      documentId: mockDC._id,
      from: "delivery_processing",
      to: "delivered",
      action: "delivery_challans:deliver",
      token: "valid_admin_token_2",
    });
    expect(mockDC.status).toBe("delivered");

    // Total 3 logs recorded
    expect(logs).toHaveLength(3);
    expect(logs.map((l) => l.documentType)).toEqual([
      "purchase_order",
      "purchase_order",
      "delivery_challan",
    ]);
  });
});

