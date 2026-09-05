import { describe, it, expect } from "vitest";
import { PERMISSIONS, ActionName, UserRole, requirePermission } from "../convex/permissions";

/**
 * Independent Ground-Truth Security Policy Table.
 *
 * S1-02 Security Invariant:
 * Every role × action pairing must match this immutable specification.
 * Widening any permission turns this test RED.
 */
const ALL_ROLES: readonly UserRole[] = [
  "admin",
  "project_manager",
  "procurement_officer",
  "site_supervisor",
] as const;

const EXPECTED_POLICY: Record<ActionName, readonly UserRole[]> = {
  // Material Requests
  "material_requests:create": ["site_supervisor", "project_manager", "admin"],
  "material_requests:update": ["site_supervisor", "project_manager", "admin"],
  "material_requests:submit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:approve": ["project_manager", "admin"],
  "material_requests:reject": ["project_manager", "admin"],
  "material_requests:query": ["project_manager", "admin"],
  "material_requests:resubmit": ["site_supervisor", "project_manager", "admin"],
  "material_requests:send_to_rfq": ["project_manager", "procurement_officer", "admin"],
  "material_requests:send_to_cc": ["project_manager", "procurement_officer", "admin"],
  "material_requests:delete": ["site_supervisor", "project_manager", "admin"],
  "material_requests:add_note": ["site_supervisor", "project_manager", "procurement_officer", "admin"],
  "material_requests:process_delivery": ["site_supervisor", "procurement_officer", "admin"],
  "material_requests:review_on_cc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_cc_approval": ["project_manager", "admin"],
  "material_requests:reset_on_cc_reject": ["project_manager", "admin"],
  "material_requests:review_on_po": ["procurement_officer", "project_manager", "admin"],
  "material_requests:advance_on_po_approval": ["project_manager", "admin"],
  "material_requests:reset_on_po_reject": ["project_manager", "admin"],
  "material_requests:close_on_short_close": ["project_manager", "admin"],
  "material_requests:advance_on_dc": ["procurement_officer", "project_manager", "admin"],
  "material_requests:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],

  // Cost Comparisons
  "cost_comparisons:create": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:update": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:submit": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:approve": ["project_manager", "admin"],
  "cost_comparisons:reject": ["project_manager", "admin"],
  "cost_comparisons:query": ["project_manager", "admin"],
  "cost_comparisons:resubmit": ["procurement_officer", "project_manager", "admin"],
  "cost_comparisons:delete": ["procurement_officer", "project_manager", "admin"],

  // Purchase Orders
  "purchase_orders:create": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:update": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:submit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:approve": ["project_manager", "admin"],
  "purchase_orders:reject": ["project_manager", "admin"],
  "purchase_orders:query": ["project_manager", "admin"],
  "purchase_orders:resubmit": ["procurement_officer", "project_manager", "admin"],
  "purchase_orders:cancel": ["project_manager", "admin"],
  "purchase_orders:close": ["project_manager", "admin"],
  "purchase_orders:close_on_receipt": ["site_supervisor", "procurement_officer", "admin"],
  "purchase_orders:delete": ["procurement_officer", "project_manager", "admin"],

  // Request for Quotations (RFQ)
  "rfqs:create": ["procurement_officer", "site_supervisor", "project_manager", "admin"],
  "rfqs:update": ["procurement_officer", "admin"],
  "rfqs:issue": ["procurement_officer", "admin"],
  "rfqs:close": ["procurement_officer", "admin"],
  "rfqs:archive": ["project_manager", "admin"],
  "rfqs:add_vendor": ["procurement_officer", "admin"],
  "rfqs:delete": ["procurement_officer", "admin"],

  // RFQ Quotes
  "rfq_quotes:add": ["procurement_officer", "admin"],
  "rfq_quotes:supersede": ["procurement_officer", "admin"],
  "rfq_quotes:delete": ["procurement_officer", "admin"],

  // Delivery Challans
  "delivery_challans:create": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:update": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:dispatch": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:cancel": ["procurement_officer", "project_manager", "admin"],
  "delivery_challans:deliver": ["site_supervisor", "procurement_officer", "admin"],

  // Goods Receipt Notes (Segregation of Duties: PM barred from physical receipt certification)
  "grn:create": ["site_supervisor", "procurement_officer", "admin"],
  "grn:update": ["site_supervisor", "procurement_officer", "admin"],
  "grn:inspect": ["site_supervisor", "project_manager", "admin"],

  // Vendors Master Data
  "vendors:create": ["procurement_officer", "project_manager", "admin"],
  "vendors:update": ["procurement_officer", "project_manager", "admin"],
  "vendors:deactivate": ["procurement_officer", "project_manager", "admin"],
  "vendors:delete": ["admin"],

  // Admin Master Data & Settings
  "tc_templates:create": ["admin"],
  "tc_templates:update": ["admin"],
  "tc_templates:delete": ["admin"],
  "project_items:create": ["project_manager", "admin"],
  "project_items:update": ["project_manager", "admin"],
  "project_items:delete": ["admin"],
  "project_items:bulk_import": ["project_manager", "admin"],
  "project_items:backfill": ["admin"],
  "projects:manage": ["admin"],
  "sites:manage": ["admin"],
  "settings:manage": ["admin"],
  "users:manage": ["admin"],
  "users:change_role": ["admin"],

  // Shared Uploads
  "files:upload": ["site_supervisor", "project_manager", "procurement_officer", "admin"],

  // Stock Movements & Inventory
  "movements:receive": ["site_supervisor", "procurement_officer", "admin"],
  "movements:issue": ["site_supervisor", "project_manager", "admin"],
  "movements:transfer": ["project_manager", "admin"],
  "movements:return": ["site_supervisor", "procurement_officer", "project_manager", "admin"],
  "movements:wastage": ["site_supervisor", "project_manager", "admin"],
  "movements:adjust": ["project_manager", "admin"],
  "movements:reverse": ["project_manager", "admin"],
  "movements:backfill": ["admin"],
  "movements:read": ["site_supervisor", "project_manager", "procurement_officer", "admin"],
};

describe("Role-Matrix Permission Specification", () => {
  const declaredActions = Object.keys(PERMISSIONS) as ActionName[];
  const expectedActions = Object.keys(EXPECTED_POLICY) as ActionName[];

  it("declares all expected actions in PERMISSIONS dictionary without missing keys", () => {
    expect(declaredActions.sort()).toEqual(expectedActions.sort());
  });

  for (const action of expectedActions) {
    describe(`Action: "${action}"`, () => {
      const allowedRoles = EXPECTED_POLICY[action];
      const deniedRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));

      it("matches the exact allowed roles definition", () => {
        expect([...PERMISSIONS[action]].sort()).toEqual([...allowedRoles].sort());
      });

      for (const role of allowedRoles) {
        it(`[ALLOW] permits role "${role}"`, () => {
          expect(PERMISSIONS[action]).toContain(role);
        });
      }

      for (const role of deniedRoles) {
        it(`[DENY] strictly forbids role "${role}"`, () => {
          expect(PERMISSIONS[action]).not.toContain(role);
        });
      }
    });
  }
});

/**
 * In-Memory Mock Context for requirePermission runtime unit testing.
 */
function createMockCtx(
  user: { _id: string; role: UserRole; isActive?: boolean } | null,
  session: { userId: string; token: string; expiresAt: number } | null
) {
  return {
    db: {
      query: (table: string) => ({
        withIndex: (_indexName: string, predicate: (q: any) => any) => {
          let queryToken: string | undefined;
          const qMock = {
            eq: (_field: string, val: string) => {
              queryToken = val;
              return qMock;
            },
          };
          predicate(qMock);

          return {
            unique: async () => {
              if (table === "sessions" && session && session.token === queryToken) {
                return session;
              }
              return null;
            },
          };
        },
      }),
      get: async (id: string) => {
        if (user && user._id === id) {
          return user;
        }
        return null;
      },
    },
  } as any;
}

describe("requirePermission Runtime Guard", () => {
  const validUser = {
    _id: "user_123",
    name: "Site Engineer",
    role: "site_supervisor" as UserRole,
    isActive: true,
  };

  const validSession = {
    _id: "session_123",
    userId: "user_123",
    token: "token_valid_123",
    expiresAt: Date.now() + 1000 * 60 * 60,
  };

  it("throws when token is undefined or empty", async () => {
    const ctx = createMockCtx(validUser, validSession);
    await expect(
      requirePermission(ctx, "material_requests:create", undefined)
    ).rejects.toThrow("Unauthorized: No authentication token provided");

    await expect(
      requirePermission(ctx, "material_requests:create", "")
    ).rejects.toThrow("Unauthorized: No authentication token provided");
  });

  it("throws when session is invalid or expired", async () => {
    const expiredSession = {
      ...validSession,
      expiresAt: Date.now() - 1000,
    };
    const ctx = createMockCtx(validUser, expiredSession);

    await expect(
      requirePermission(ctx, "material_requests:create", "token_valid_123")
    ).rejects.toThrow("Unauthorized: Invalid or expired session token");

    const ctxUnknown = createMockCtx(validUser, validSession);
    await expect(
      requirePermission(ctxUnknown, "material_requests:create", "non_existent_token")
    ).rejects.toThrow("Unauthorized: Invalid or expired session token");
  });

  it("throws when user account is deactivated", async () => {
    const inactiveUser = { ...validUser, isActive: false };
    const ctx = createMockCtx(inactiveUser, validSession);

    await expect(
      requirePermission(ctx, "material_requests:create", "token_valid_123")
    ).rejects.toThrow("Unauthorized: Your account has been deactivated");
  });

  it("throws when user role is not authorized for the action", async () => {
    const ctx = createMockCtx(validUser, validSession);

    // Site Supervisor attempting to cancel a PO or create T&C template
    await expect(
      requirePermission(ctx, "purchase_orders:cancel", "token_valid_123")
    ).rejects.toThrow(
      'Unauthorized: Action "purchase_orders:cancel" requires one of these roles: [project_manager, admin]. Your role is: "site_supervisor".'
    );

    await expect(
      requirePermission(ctx, "tc_templates:create", "token_valid_123")
    ).rejects.toThrow(
      'Unauthorized: Action "tc_templates:create" requires one of these roles: [admin]. Your role is: "site_supervisor".'
    );
  });

  it("succeeds and returns user when role is authorized", async () => {
    const ctx = createMockCtx(validUser, validSession);

    const caller = await requirePermission(
      ctx,
      "material_requests:create",
      "token_valid_123"
    );

    expect(caller).toBeDefined();
    expect(caller._id).toBe("user_123");
    expect(caller.role).toBe("site_supervisor");
  });
});
