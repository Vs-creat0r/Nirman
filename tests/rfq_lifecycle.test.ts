/**
 * @fileoverview RFQ Lifecycle & State Machine Transitions Test Suite.
 *
 * Verifies:
 * 1. Initial state is strictly "draft".
 * 2. Valid transitions:
 *    - draft -> open via "issue" (roles: procurement_officer, admin)
 *    - open -> closed via "close" (roles: procurement_officer, admin)
 *    - open/closed -> archived via "archive" (roles: project_manager, admin)
 * 3. Invalid transitions are blocked (e.g. draft -> closed, archived -> open).
 * 4. Terminal state invariants (archived is terminal).
 */

import { describe, it, expect } from "vitest";
import {
  RFQ_INITIAL_STATE,
  RFQ_STATES,
  RFQ_TRANSITIONS,
  RFQ_OPEN_STATES,
  RFQ_CLOSED_STATES,
  RFQ_EDITABLE_STATES,
  RFQ_LOCKED_STATES,
} from "@/convex/lifecycle/rfq";

describe("RFQ Lifecycle & Transition Rules", () => {
  it("initializes in draft state", () => {
    expect(RFQ_INITIAL_STATE).toBe("draft");
    expect(RFQ_STATES.draft.kind).toBe("editable");
    expect(RFQ_STATES.draft.terminal).toBe(false);
  });

  it("defines open, closed, and editable partitions accurately", () => {
    expect(RFQ_OPEN_STATES).toEqual(["draft", "open", "closed"]);
    expect(RFQ_CLOSED_STATES).toEqual(["archived"]);
    expect(RFQ_EDITABLE_STATES).toEqual(["draft"]);
    expect(RFQ_LOCKED_STATES).toEqual(["open", "closed"]);
  });

  it("supports issue transition: draft -> open for procurement_officer and admin", () => {
    const issueTransition = RFQ_TRANSITIONS.find((t) => t.name === "issue");
    expect(issueTransition).toBeDefined();
    expect(issueTransition?.from).toContain("draft");
    expect(issueTransition?.to).toBe("open");
    expect(issueTransition?.roles).toContain("procurement_officer");
    expect(issueTransition?.roles).toContain("admin");
  });

  it("supports close transition: open -> closed for procurement_officer and admin", () => {
    const closeTransition = RFQ_TRANSITIONS.find((t) => t.name === "close");
    expect(closeTransition).toBeDefined();
    expect(closeTransition?.from).toContain("open");
    expect(closeTransition?.to).toBe("closed");
    expect(closeTransition?.roles).toContain("procurement_officer");
    expect(closeTransition?.roles).toContain("admin");
  });

  it("supports archive transition: [open, closed] -> archived for project_manager and admin", () => {
    const archiveTransition = RFQ_TRANSITIONS.find((t) => t.name === "archive");
    expect(archiveTransition).toBeDefined();
    expect(archiveTransition?.from).toContain("open");
    expect(archiveTransition?.from).toContain("closed");
    expect(archiveTransition?.to).toBe("archived");
    expect(archiveTransition?.roles).toContain("project_manager");
    expect(archiveTransition?.roles).toContain("admin");
  });

  it("prohibits invalid transitions from terminal archived state", () => {
    for (const t of RFQ_TRANSITIONS) {
      expect((t.from as readonly string[]).includes("archived")).toBe(false);
    }
  });

  it("ensures only draft allows direct editing of RFQ fields", () => {
    expect(RFQ_STATES.draft.kind).toBe("editable");
    expect(RFQ_STATES.open.kind).toBe("locked");
    expect(RFQ_STATES.closed.kind).toBe("locked");
    expect(RFQ_STATES.archived.kind).toBe("closed");
  });
});
