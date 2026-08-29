/**
 * @fileoverview Purchase Order inventory commitment calculations and adjustments.
 *
 * Resolves projectItemId linkage and updates committedQty on project_items [FIX-B1].
 */

import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface CommitmentLineItem {
  itemName: string;
  quantity: number;
  projectItemId?: Id<"project_items">;
}

export interface CommitmentMRItem {
  itemName: string;
  projectItemId?: Id<"project_items">;
}

/**
 * Adjusts committedQty on project_items for line items with resolved projectItemId [FIX-B1].
 */
export async function adjustCommittedQty(
  ctx: MutationCtx,
  lineItems: CommitmentLineItem[],
  delta: number,
  mrItems?: CommitmentMRItem[]
) {
  for (const item of lineItems) {
    let projectItemId = item.projectItemId;
    if (!projectItemId && mrItems) {
      const match = mrItems.find(
        (m) => m.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()
      );
      if (match?.projectItemId) {
        projectItemId = match.projectItemId;
      }
    }

    if (projectItemId) {
      const projectItem = await ctx.db.get(projectItemId);
      if (projectItem) {
        const currentCommitted = projectItem.committedQty ?? 0;
        const newCommitted = Math.max(0, currentCommitted + delta * item.quantity);
        await ctx.db.patch(projectItemId, {
          committedQty: newCommitted,
        });
      }
    } else {
      console.error(`[PO Commitment] Could not resolve projectItemId for item "${item.itemName}"`);
    }
  }
}
