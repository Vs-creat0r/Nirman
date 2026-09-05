// GENERATED FILE — do not edit.
// Source: contracts/*.json  ·  Regenerate: node scripts/generate-from-contracts.mjs

import type { CascadeRule, TransitionDef } from "./types";

export type RfqState = "draft" | "open" | "closed" | "archived";

export const RFQ_INITIAL_STATE: RfqState = "draft";

export const RFQ_STATES = {
  draft: { kind: "editable", owner: "creator", terminal: false, badge: { label: "Draft", variant: "secondary" } },
  open: { kind: "locked", owner: "none", terminal: false, badge: { label: "Open", variant: "default" } },
  closed: { kind: "locked", owner: "none", terminal: false, badge: { label: "Closed", variant: "default" } },
  archived: { kind: "closed", owner: "none", terminal: true, badge: { label: "Archived", variant: "destructive" } },
} as const;

export const RFQ_OPEN_STATES: readonly RfqState[] = ["draft", "open", "closed"] as const;

export const RFQ_CLOSED_STATES: readonly RfqState[] = ["archived"] as const;

export const RFQ_EDITABLE_STATES: readonly RfqState[] = ["draft"] as const;

export const RFQ_LOCKED_STATES: readonly RfqState[] = ["open", "closed"] as const;

export const RFQ_TRANSITIONS = [
  {
    name: "issue",
    label: "Issue RFQ",
    from: ["draft"] as const,
    to: "open",
    roles: ["procurement_officer", "admin"] as const,
    actor: "creator",
  },
  {
    name: "close",
    label: "Close RFQ",
    from: ["open"] as const,
    to: "closed",
    roles: ["procurement_officer", "admin"] as const,
    actor: "creator",
  },
  {
    name: "archive",
    label: "Archive RFQ",
    from: ["open", "closed"] as const,
    to: "archived",
    roles: ["project_manager", "admin"] as const,
    actor: "creator",
  },
] as const satisfies readonly TransitionDef<RfqState>[];

export type RfqTransitionName = (typeof RFQ_TRANSITIONS)[number]["name"];
