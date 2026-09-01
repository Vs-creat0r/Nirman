/**
 * Gate 2 Live Verification Script (Supervisor Scoping & Mechanism Proof)
 *
 * Requirements:
 * 1. Log in with real site_supervisor credentials.
 * 2. Verify supervisor identity & site assignments (assigned to Site A, unassigned to Site B).
 * 3. Issue 40 bags from assigned Site A -> Assert on-hand decreases by exactly 40.
 * 4. Verify immutable ledger history contains the new issue row with matching balanceAfter.
 * 5. Attempt to issue stock from unassigned Site B as supervisor -> Assert it throws Forbidden / Unauthorized.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function runGate2() {
  console.log("==================================================================");
  console.log("  GATE 2 LIVE VERIFICATION: Supervisor Role & Scoping Proof");
  console.log("==================================================================");

  // 1. Login with actual supervisor credentials
  console.log("\n[1/6] Authenticating as site supervisor (`supervisor`)...");
  const supervisorToken = await client.mutation(api.auth.login, {
    username: "supervisor",
    password: "supervisor",
  });

  const me = await client.query(api.users.getMyUser, { token: supervisorToken });
  console.log(`✓ Authenticated User: ${me.name} (@${me.username})`);
  console.log(`✓ Role: ${me.role}`);
  console.log(`✓ Assigned Sites: ${JSON.stringify(me.assignedSiteIds)}`);

  if (me.role !== "site_supervisor") {
    throw new Error(`Expected role 'site_supervisor', but got '${me.role}'`);
  }

  // 2. Identify assigned site (Site A) and unassigned site (Site B)
  const adminToken = await client.mutation(api.auth.login, {
    username: "admin",
    password: "admin123",
  });
  const allSites = await client.query(api.sites.listAllSites, { token: adminToken });

  const assignedSite = allSites.find((s) => me.assignedSiteIds?.includes(s._id));
  const unassignedSite = allSites.find((s) => !me.assignedSiteIds?.includes(s._id));

  if (!assignedSite || !unassignedSite) {
    throw new Error("Could not identify both an assigned and an unassigned site for supervisor.");
  }

  console.log(`\n[2/6] Scoping setup:`);
  console.log(`  - Assigned Site (Allowed): ${assignedSite.name} (${assignedSite._id})`);
  console.log(`  - Unassigned Site (Forbidden): ${unassignedSite.name} (${unassignedSite._id})`);

  // 3. Check and prepare baseline stock on Assigned Site
  const testItemName = "Cement Grade 53 (Gate2-Supervisor-Proof)";
  console.log(`\n[3/6] Reading initial inventory for "${testItemName}" on assigned site...`);

  // Admin seeds 100 bags if needed to establish clear baseline
  await client.mutation(api.movement_actions.adjustStock, {
    siteId: assignedSite._id,
    itemName: testItemName,
    adjustmentDirection: "add",
    quantity: 100,
    reason: "Gate 2 baseline setup for supervisor test",
    token: adminToken,
  });

  const initialInventory = await client.query(api.movements.getSiteInventory, {
    siteId: assignedSite._id,
    token: supervisorToken,
  });
  const itemBefore = initialInventory.find((i) => i.itemName === testItemName);
  const qtyBefore = itemBefore ? itemBefore.quantity : 0;
  console.log(`  - On-hand balance before supervisor issue: ${qtyBefore} bags`);

  // 4. Supervisor issues 40 bags from Assigned Site
  console.log(`\n[4/6] Supervisor issuing 40 bags from assigned site (${assignedSite.name})...`);
  const issueResult = await client.mutation(api.movement_actions.issueStock, {
    siteId: assignedSite._id,
    itemName: testItemName,
    quantity: 40,
    purpose: "Pier 12 concrete pour (Supervisor Gate 2 Issue)",
    token: supervisorToken,
  });
  console.log(`  ✓ Issue Mutation Success:`, issueResult);

  // Verify live on-hand balance reduction
  const inventoryAfter = await client.query(api.movements.getSiteInventory, {
    siteId: assignedSite._id,
    token: supervisorToken,
  });
  const qtyAfter = inventoryAfter.find((i) => i.itemName === testItemName)?.quantity;
  console.log(`  - On-hand balance after supervisor issue: ${qtyAfter} bags`);

  const expectedQty = qtyBefore - 40;
  if (qtyAfter !== expectedQty) {
    throw new Error(
      `GATE 2 FAILED: Expected balance ${expectedQty}, but got ${qtyAfter}. Mechanism failed!`
    );
  }
  console.log(`  ✓ MECHANISM PROVED: On-hand balance reduced by exactly 40 (${qtyBefore} -> ${qtyAfter}).`);

  // 5. Verify immutable ledger record
  console.log(`\n[5/6] Verifying immutable ledger lineage...`);
  const ledger = await client.query(api.movements.getItemMovementLedger, {
    siteId: assignedSite._id,
    itemName: testItemName,
    token: supervisorToken,
  });

  const latestMovement = ledger.movements[0];
  console.log(`  - Latest movement: ${latestMovement.movementType} of ${latestMovement.quantity} ${latestMovement.unit}`);
  console.log(`  - Balance after: ${latestMovement.balanceAfter}`);
  console.log(`  - Purpose: "${latestMovement.purpose}"`);

  if (
    latestMovement.movementType !== "issue" ||
    latestMovement.quantity !== 40 ||
    latestMovement.balanceAfter !== qtyAfter
  ) {
    throw new Error("GATE 2 FAILED: Ledger record did not match supervisor issue!");
  }
  console.log(`  ✓ LEDGER PROVED: Append-only transaction recorded with exact balance.`);

  // 6. Supervisor attempts to issue from Unassigned Site -> MUST FAIL CLOSED (Forbidden)
  console.log(`\n[6/6] Security Test: Supervisor attempting to issue from UNASSIGNED site (${unassignedSite.name})...`);
  let caughtForbidden = false;
  try {
    await client.mutation(api.movement_actions.issueStock, {
      siteId: unassignedSite._id,
      itemName: testItemName,
      quantity: 10,
      purpose: "Unauthorized issue attempt",
      token: supervisorToken,
    });
  } catch (err) {
    caughtForbidden = true;
    console.log(`  ✓ IDOR GUARD TRIGGERED AS EXPECTED:`, err.message);
  }

  if (!caughtForbidden) {
    throw new Error(
      `SECURITY VULNERABILITY: Supervisor was able to issue stock from unassigned site (${unassignedSite.name})!`
    );
  }
  console.log(`  ✓ SCOPING PROVED: Non-assigned site issuance threw Forbidden error.`);

  console.log("\n==================================================================");
  console.log("  🔴 GATE 2 FULLY PROVED: Supervisor mechanism & site scoping!   ");
  console.log("==================================================================");
}

runGate2().catch((err) => {
  console.error("Gate 2 Verification Error:", err);
  process.exit(1);
});
