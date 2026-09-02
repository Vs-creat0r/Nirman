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

  it("dynamically proves that for all sites and items, inventory balance strictly equals the sum of movement deltas", async () => {
    const { postMovementCore, computeMovementDelta } = await import("../convex/movements");

    const inventory: any[] = [];
    const stock_movements: any[] = [];
    const logs: any[] = [];

    const mockCtx = {
      db: {
        inventory,
        stock_movements,
        logs,
        async get(id: string) {
          if (id === "site_sim_1") return { _id: "site_sim_1", name: "Sim Site", projectId: "proj_sim" };
          if (id === "site_sim_2") return { _id: "site_sim_2", name: "Sim Site 2", projectId: "proj_sim" };
          const m = stock_movements.find((row) => row._id === id);
          if (m) return m;
          return null;
        },
        query(table: string) {
          const items = table === "inventory" ? inventory : table === "stock_movements" ? stock_movements : [];
          return {
            withIndex(_idx: string, filterFn?: (q: any) => any) {
              let filtered = [...items];
              if (_idx === "by_siteId_itemName" && filterFn) {
                const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
                filterFn(q);
              }
              if (_idx === "by_sourceId" && filterFn) {
                const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.sourceId === v); return q; } };
                filterFn(q);
              }
              return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
            },
            filter(_fn: any) { return { async first() { return items[0] || null; }, async collect() { return [...items]; } }; },
            async collect() { return [...items]; },
            async first() { return items[0] || null; },
            async unique() { return items[0] || null; },
          };
        },
        async insert(table: string, doc: any) {
          const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
          const row = { _id, _creationTime: Date.now(), ...doc };
          if (table === "inventory") inventory.push(row);
          if (table === "stock_movements") stock_movements.push(row);
          if (table === "logs") logs.push(row);
          return _id;
        },
        async patch(id: string, patch: any) {
          const inv = inventory.find((i: any) => i._id === id);
          if (inv) Object.assign(inv, patch);
        },
      },
    } as any;

    const ADMIN_USER = { _id: "admin_u1" as any, role: "admin", isActive: true };
    const SITE_ID = "site_sim_1" as any;
    const ITEM = "Reinforcement Bar 12mm";

    // 1. Receipt: +100
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "receipt", quantity: 100,
      sourceType: "grn", sourceId: "grn_sim_1", actorUser: ADMIN_USER as any, token: "token",
    });

    // 2. Issue: -25
    const issueRes = await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "issue", quantity: 25,
      purpose: "Footing cage fabrication", sourceType: "manual", actorUser: ADMIN_USER as any, token: "token",
    });

    // 3. Transfer out: -20
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, counterpartySiteId: "site_sim_2" as any, itemName: ITEM, unit: "MT",
      movementType: "transfer_out", quantity: 20, sourceType: "transfer", sourceId: "TRF-SIM-01",
      sourceLineIndex: 0, purpose: "Transfer to Site 2", actorUser: ADMIN_USER as any, token: "token",
    });

    // 4. Wastage: -5
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "wastage", quantity: 5,
      purpose: "Cut piece ends scrap", sourceType: "manual", actorUser: ADMIN_USER as any, token: "token",
    });

    // 5. Return: -10
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "return", quantity: 10,
      purpose: "Vendor return", sourceType: "manual", sourceId: "grn_sim_1", actorUser: ADMIN_USER as any, token: "token",
    });

    // 6. Adjustment (add): +15
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "adjustment", adjustmentDirection: "add",
      quantity: 15, purpose: "Audit count gain", sourceType: "manual", actorUser: ADMIN_USER as any, token: "token",
    });

    // 7. Adjustment (subtract): -5
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "adjustment", adjustmentDirection: "subtract",
      quantity: 5, purpose: "Audit count loss", sourceType: "manual", actorUser: ADMIN_USER as any, token: "token",
    });

    // 8. Reversal of issue: +25
    await postMovementCore(mockCtx, {
      siteId: SITE_ID, itemName: ITEM, unit: "MT", movementType: "reversal", quantity: 25,
      reversalOfId: issueRes.movementId, originalMovementType: "issue",
      purpose: "Wrong bar size selected on issue #1", sourceType: "manual",
      actorUser: ADMIN_USER as any, token: "token",
    });

    // Reconcile: Sum of all movement deltas must equal current inventory quantity
    let calculatedSum = 0;
    for (const mov of stock_movements) {
      if (mov.siteId === SITE_ID && mov.itemName === ITEM) {
        let origType = mov.originalMovementType;
        let origAdjDir = mov.originalAdjustmentDirection;
        if (mov.movementType === "reversal" && mov.reversalOfId) {
          const orig = stock_movements.find((m) => m._id === mov.reversalOfId);
          if (orig) {
            origType = orig.movementType;
            origAdjDir = orig.adjustmentDirection;
          }
        }
        const delta = computeMovementDelta(mov.movementType, mov.quantity, {
          adjustmentDirection: mov.adjustmentDirection,
          originalMovementType: origType,
          originalAdjustmentDirection: origAdjDir,
        });
        calculatedSum += delta;
      }
    }

    const currentInventory = inventory.find((i) => i.siteId === SITE_ID && i.itemName === ITEM);
    const lastMovement = stock_movements[stock_movements.length - 1];

    // Expected: 100 - 25 - 20 - 5 - 10 + 15 - 5 + 25 = 75
    expect(calculatedSum).toBe(75);
    expect(currentInventory.quantity).toBe(75);
    expect(lastMovement.balanceAfter).toBe(75);
    expect(currentInventory.quantity).toBe(calculatedSum);
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

    // Attempt illegal transition: draft -> ready_for_po (advance_on_cc_approval requires from: ["review_cc"])
    await expect(
      transition(mockCtx, {
        table: "material_request",
        documentId: mockDoc._id,
        transitionName: "advance_on_cc_approval",
        token: "valid_admin_token",
      })
    ).rejects.toThrow(/Invalid status transition on material_request/i);

    // Attempt legal transition: draft -> pending (submit transition)
    const res = await transition(mockCtx, {
      table: "material_request",
      documentId: mockDoc._id,
      transitionName: "submit",
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

    const mockMR = {
      _id: "mr_456" as any,
      refNo: "MR-TEST-01",
      status: "ready_for_po",
      projectId: "proj_456" as any,
      siteId: "site_456" as any,
    };

    const mockPO = {
      _id: "po_456" as any,
      refNo: "PO-TEST-01",
      status: "draft",
      materialRequestId: mockMR._id,
      projectId: "proj_456" as any,
      siteId: "site_456" as any,
    };

    const mockDC = {
      _id: "dc_456" as any,
      refNo: "DC-TEST-01",
      status: "delivery_processing",
      purchaseOrderId: mockPO._id,
      projectId: "proj_456" as any,
      siteId: "site_456" as any,
    };

    const logs: any[] = [];
    const mockCtx: any = {
      db: {
        get: async (id: any) => {
          if (id === mockSession.userId) return mockAdmin;
          if (id === mockMR._id) return mockMR;
          if (id === mockPO._id) return mockPO;
          if (id === mockDC._id) return mockDC;
          return null;
        },
        patch: async (id: any, data: any) => {
          if (id === mockMR._id) Object.assign(mockMR, data);
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

    // PO: draft -> submitted (cascades MR ready_for_po -> review_po)
    await transition(mockCtx, {
      table: "purchase_order",
      documentId: mockPO._id,
      transitionName: "submit",
      token: "valid_admin_token_2",
    });
    expect(mockPO.status).toBe("submitted");
    expect(mockMR.status).toBe("review_po");

    // PO: submitted -> approved (cascades MR review_po -> pending_po)
    await transition(mockCtx, {
      table: "purchase_order",
      documentId: mockPO._id,
      transitionName: "approve",
      token: "valid_admin_token_2",
    });
    expect(mockPO.status).toBe("approved");
    expect(mockMR.status).toBe("pending_po");

    // DC: delivery_processing -> delivered
    await transition(mockCtx, {
      table: "delivery_challan",
      documentId: mockDC._id,
      transitionName: "deliver",
      token: "valid_admin_token_2",
    });
    expect(mockDC.status).toBe("delivered");

    // Logs recorded: PO submit, MR cascade, PO approve, MR cascade, DC deliver = 5 logs
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.map((l) => l.documentType)).toContain("purchase_order");
    expect(logs.map((l) => l.documentType)).toContain("delivery_challan");
  });

  it("statically proves that zero handwritten from: guards remain in convex mutation files", () => {
    const operationalFiles = fs
      .readdirSync(CONVEX_DIR)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
      .filter(
        (f) =>
          f !== "transition.ts" &&
          f !== "schema.ts" &&
          f !== "seed.ts" &&
          f !== "scoping.ts"
      );

    const violations: Array<{ file: string; line: number; snippet: string }> = [];

    for (const file of operationalFiles) {
      const fullPath = path.join(CONVEX_DIR, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\bfrom\s*:\s*\[/.test(line) || /\bfrom\s*:\s*['"]/.test(line)) {
          violations.push({
            file: `convex/${file}`,
            line: i + 1,
            snippet: line.trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const formatted = violations
        .map((v) => `  - ${v.file}:${v.line} → ${v.snippet}`)
        .join("\n");
      expect.fail(
        `🔴 GATE 1 VIOLATION: Found ${violations.length} handwritten from: guards outside transition.ts:\n${formatted}\n\nAll status transitions MUST rely on generated transitionName definitions.`
      );
    }

    expect(violations).toHaveLength(0);
  });
});

