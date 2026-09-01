import { describe, it, expect } from "vitest";
import { createMR, submitMR } from "../convex/material_requests";
import { postMovementCore } from "../convex/movements";

interface MockDocument {
  _id: string;
  [key: string]: unknown;
}

function createSettingsMockContext(initial: {
  settings?: Record<string, unknown>;
  users?: MockDocument[];
  inventory?: MockDocument[];
  stock_movements?: MockDocument[];
  material_request?: MockDocument[];
  sites?: MockDocument[];
  projects?: MockDocument[];
}) {
  const store: Record<string, MockDocument[]> = {
    settings: initial.settings ? [{ _id: "settings_1", ...initial.settings }] : [],
    users: initial.users || [
      {
        _id: "user_sup",
        role: "site_supervisor",
        name: "Supervisor",
        username: "supervisor",
        isActive: true,
        assignedSiteIds: ["site_1"],
        assignedProjectIds: ["proj_1"],
      },
      {
        _id: "user_admin",
        role: "admin",
        name: "Admin",
        username: "admin",
        isActive: true,
        assignedSiteIds: [],
        assignedProjectIds: [],
      },
    ],
    inventory: initial.inventory ? [...initial.inventory] : [],
    stock_movements: initial.stock_movements ? [...initial.stock_movements] : [],
    material_request: initial.material_request ? [...initial.material_request] : [],
    sites: initial.sites || [{ _id: "site_1", projectId: "proj_1", name: "Main Site", isActive: true }],
    projects: initial.projects || [{ _id: "proj_1", name: "Project Alpha", code: "PRJ-01", isActive: true }],
    logs: [],
    sessions: [
      {
        _id: "sess_sup",
        userId: "user_sup",
        token: "sup_token",
        expiresAt: Date.now() + 1000000,
      },
      {
        _id: "sess_admin",
        userId: "user_admin",
        token: "admin_token",
        expiresAt: Date.now() + 1000000,
      },
    ],
  };

  const db = {
    async get(id: string) {
      for (const list of Object.values(store)) {
        const found = list.find((doc) => doc._id === id);
        if (found) return found;
      }
      return null;
    },

    async insert(table: string, doc: Record<string, unknown>) {
      const id = `${table}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newDoc = { _id: id, ...doc, _creationTime: Date.now() };
      if (!store[table]) store[table] = [];
      store[table].push(newDoc);
      return id;
    },

    async patch(id: string, updates: Record<string, unknown>) {
      for (const list of Object.values(store)) {
        const found = list.find((doc) => doc._id === id);
        if (found) {
          Object.assign(found, updates);
          return;
        }
      }
    },

    query(tableName: string) {
      const items = store[tableName] || [];
      return {
        filter(filterFn: (q: unknown) => boolean) {
          const filtered = items.filter(filterFn);
          return {
            collect: async () => filtered,
            first: async () => filtered[0] || null,
          };
        },
        withIndex(idxName: string, filterFn?: (q: unknown) => unknown) {
          let filtered = [...items];
          if (filterFn) {
            const q = {
              eq: (field: string, val: unknown) => {
                filtered = filtered.filter((i) => i[field] === val);
                return {
                  eq: (field2: string, val2: unknown) => {
                    filtered = filtered.filter((i) => i[field2] === val2);
                    return q;
                  },
                };
              },
            };
            filterFn(q);
          }
          return {
            collect: async () => filtered,
            first: async () => filtered[0] || null,
            unique: async () => filtered[0] || null,
          };
        },
        collect: async () => [...items],
        first: async () => items[0] || null,
        unique: async () => items[0] || null,
      };
    },
  };

  return { db, store };
}

describe("S2-13 & S2-14: Real Business Settings & Approval Bypass Wiring", () => {
  describe("S2-13: requireManagerApprovalForRequests setting", () => {
    it("routes MR from draft -> ready_for_cc when requireManagerApprovalForRequests is false", async () => {
      const { db, store } = createSettingsMockContext({
        settings: { requireManagerApprovalForRequests: false },
        material_request: [
          {
            _id: "mr_draft_1",
            refNo: "MR-2026-0001",
            projectId: "proj_1",
            siteId: "site_1",
            items: [{ itemName: "Cement", quantity: 10, unit: "bags" }],
            status: "draft",
            createdBy: "user_sup",
          },
        ],
      });

      const res = await (submitMR as unknown as { _handler: Function })._handler(
        { db },
        { id: "mr_draft_1", token: "sup_token" }
      );

      expect(res.toStatus).toBe("ready_for_cc");
      const updatedMR = store.material_request.find((m) => m._id === "mr_draft_1");
      expect(updatedMR?.status).toBe("ready_for_cc");
    });

    it("routes MR from draft -> pending when requireManagerApprovalForRequests is true (default)", async () => {
      const { db, store } = createSettingsMockContext({
        settings: { requireManagerApprovalForRequests: true },
        material_request: [
          {
            _id: "mr_draft_2",
            refNo: "MR-2026-0002",
            projectId: "proj_1",
            siteId: "site_1",
            items: [{ itemName: "Sand", quantity: 5, unit: "cum" }],
            status: "draft",
            createdBy: "user_sup",
          },
        ],
      });

      const res = await (submitMR as unknown as { _handler: Function })._handler(
        { db },
        { id: "mr_draft_2", token: "sup_token" }
      );

      expect(res.toStatus).toBe("pending");
      const updatedMR = store.material_request.find((m) => m._id === "mr_draft_2");
      expect(updatedMR?.status).toBe("pending");
    });

    it("auto-approves supervisor createMR immediately when submitImmediately is true and setting is false", async () => {
      const { db } = createSettingsMockContext({
        settings: { requireManagerApprovalForRequests: false },
      });

      const res = await (createMR as unknown as { _handler: Function })._handler(
        { db },
        {
          projectId: "proj_1",
          siteId: "site_1",
          items: [{ itemName: "Steel 8mm", quantity: 100, unit: "kg" }],
          priority: "urgent",
          submitImmediately: true,
          token: "sup_token",
        }
      );

      expect(res.status).toBe("ready_for_cc");
    });
  });

  describe("S2-14: allowNegativeStock & defaultReorderLevel settings", () => {
    it("strictly blocks negative stock issuance when allowNegativeStock is false", async () => {
      const { db } = createSettingsMockContext({
        settings: { allowNegativeStock: false },
        inventory: [
          {
            _id: "inv_1",
            siteId: "site_1",
            projectId: "proj_1",
            itemName: "Brick Red",
            quantity: 10,
            unit: "nos",
          },
        ],
      });

      await expect(
        postMovementCore(
          { db } as unknown as Parameters<typeof postMovementCore>[0],
          {
            siteId: "site_1" as unknown as Parameters<typeof postMovementCore>[1]["siteId"],
            itemName: "Brick Red",
            unit: "nos",
            movementType: "issue",
            quantity: 15, // 10 - 15 = -5
            sourceType: "manual",
            purpose: "Foundation wall work",
            token: "sup_token",
          }
        )
      ).rejects.toThrow(/Negative stock is prohibited by system inventory policy/);
    });

    it("allows negative stock issuance when allowNegativeStock is true, flagging isNegativeStock", async () => {
      const { db, store } = createSettingsMockContext({
        settings: { allowNegativeStock: true },
        inventory: [
          {
            _id: "inv_2",
            siteId: "site_1",
            projectId: "proj_1",
            itemName: "Plywood 18mm",
            quantity: 5,
            unit: "nos",
          },
        ],
      });

      const result = await postMovementCore(
        { db } as unknown as Parameters<typeof postMovementCore>[0],
        {
          siteId: "site_1" as unknown as Parameters<typeof postMovementCore>[1]["siteId"],
          itemName: "Plywood 18mm",
          unit: "nos",
          movementType: "issue",
          quantity: 10, // 5 - 10 = -5
          sourceType: "manual",
          purpose: "Formwork urgently needed",
          token: "sup_token",
        }
      );

      expect(result.balanceAfter).toBe(-5);
      expect(result.isNegativeStock).toBe(true);

      const inv = store.inventory.find((i) => i.itemName === "Plywood 18mm");
      expect(inv?.quantity).toBe(-5);
    });

    it("sets inventory reorderLevel from settings.defaultReorderLevel on new records", async () => {
      const { db, store } = createSettingsMockContext({
        settings: { defaultReorderLevel: 25 },
      });

      await postMovementCore(
        { db } as unknown as Parameters<typeof postMovementCore>[0],
        {
          siteId: "site_1" as unknown as Parameters<typeof postMovementCore>[1]["siteId"],
          itemName: "Tile Adhesive",
          movementType: "receipt",
          quantity: 50,
          unit: "bags",
          sourceType: "grn",
          sourceId: "grn_101",
          token: "admin_token",
        }
      );

      const inv = store.inventory.find((i) => i.itemName === "Tile Adhesive");
      expect(inv?.reorderLevel).toBe(25);
    });
  });
});
