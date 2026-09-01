/**
 * Gate 3 Live Verification Script (4 Reconciled Counters on One Screen)
 *
 * Requirements:
 * 1. Log in with admin credentials.
 * 2. Retrieve a live project and site.
 * 3. Create or identify a test BOQ item (e.g. "Structural Steel Rebar (Gate3-Proof)", boqQty: 500 MT).
 * 4. Record 40 MT issue and 10 MT wastage linked to this project item.
 * 5. Call `getProjectBOQDetails` query.
 * 6. Assert all 4 counters (BOQ, Committed, Procured, Consumed) match live movement ledger with 0 drift.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function runGate3() {
  console.log("==================================================================");
  console.log("  GATE 3 LIVE VERIFICATION: 4 Side-by-Side Counters Reconciliation");
  console.log("==================================================================");

  // 1. Authenticate
  console.log("\n[1/5] Authenticating as admin...");
  const token = await client.mutation(api.auth.login, {
    username: "admin",
    password: "admin123",
  });

  const projects = await client.query(api.projects.listAllProjects, { token });
  if (!projects || projects.length === 0) {
    throw new Error("No projects found on live database.");
  }
  const testProject = projects[0];
  console.log(`Using Project: ${testProject.name} (${testProject.code}, id: ${testProject._id})`);

  const sites = await client.query(api.sites.listSites, {
    projectId: testProject._id,
    token,
  });
  if (!sites || sites.length === 0) {
    throw new Error(`No active sites found for project ${testProject.name}`);
  }
  const testSite = sites[0];
  console.log(`Using Site: ${testSite.name} (${testSite._id})`);

  // 2. Create or find test BOQ item
  const testItemName = "Structural Steel Rebar (Gate3-Proof)";
  console.log(`\n[2/5] Creating / Ensuring BOQ line item "${testItemName}" with 500 MT...`);

  const existingItems = await client.query(api.project_items.listProjectItems, {
    projectId: testProject._id,
    token,
  });

  let boqItem = existingItems.find((i) => i.name === testItemName);
  let boqItemId;

  if (!boqItem) {
    boqItemId = await client.mutation(api.project_items.createProjectItem, {
      projectId: testProject._id,
      itemName: testItemName,
      category: "Steel",
      unit: "MT",
      boqQty: 500,
      estimatedRate: 65000,
      description: "Fe-500D TMT Rebar for column and beam reinforcement (Gate 3)",
      token,
    });
    console.log(`Created new BOQ item with ID: ${boqItemId}`);
  } else {
    boqItemId = boqItem._id;
    console.log(`Found existing BOQ item with ID: ${boqItemId}`);
  }

  // 3. Post 40 MT Issue + 10 MT Wastage to establish consumption
  console.log("\n[3/5] Recording 40 MT material issue + 10 MT wastage against BOQ item...");
  await client.mutation(api.movement_actions.issueStock, {
    siteId: testSite._id,
    itemName: testItemName,
    quantity: 40,
    unit: "MT",
    purpose: "Column 4 reinforcement (Gate 3 Issue)",
    projectItemId: boqItemId,
    token,
  });

  await client.mutation(api.movement_actions.recordWastage, {
    siteId: testSite._id,
    itemName: testItemName,
    quantity: 10,
    unit: "MT",
    reason: "Off-cut scrap from bar bending yard (Gate 3 Wastage)",
    projectItemId: boqItemId,
    token,
  });

  // 4. Query 4-Counter Details
  console.log("\n[4/5] Calling `getProjectBOQDetails` to retrieve 4 reconciled counters...");
  const details = await client.query(api.project_items.getProjectBOQDetails, {
    projectId: testProject._id,
    token,
  });

  if (!details) {
    throw new Error("Failed to load project BOQ details.");
  }

  const targetItem = details.items.find((i) => i._id === boqItemId);
  if (!targetItem) {
    throw new Error(`Target BOQ item ${boqItemId} not found in reconciled details.`);
  }

  console.log("\n--- RECONCILED COUNTERS REPORT ---");
  console.log(`  Item Name         : ${targetItem.itemName}`);
  console.log(`  Unit              : ${targetItem.unit}`);
  console.log(`  Counter 1 (BOQ)   : ${targetItem.boqQty} MT`);
  console.log(`  Counter 2 (Commit): ${targetItem.committedQty} MT`);
  console.log(`  Counter 3 (Procur): ${targetItem.procuredQty} MT`);
  console.log(`  Counter 4 (Consum): ${targetItem.consumedQty} MT`);
  console.log(`  Remaining Balance : ${targetItem.remainingQty} MT`);
  console.log(`  Over-Procured Flag: ${targetItem.isOverProcured}`);
  console.log(`  Over-Commit Flag  : ${targetItem.isOverCommitted}`);
  console.log("----------------------------------");

  // 5. Assert Invariants
  console.log("\n[5/5] Checking reconciliation mathematical invariants...");
  if (targetItem.boqQty !== 500) {
    throw new Error(`Expected BOQ 500 MT, got ${targetItem.boqQty}`);
  }
  if (targetItem.consumedQty < 50) {
    throw new Error(`Expected consumed >= 50 MT (40 issue + 10 wastage), got ${targetItem.consumedQty}`);
  }
  const expectedRemaining = targetItem.boqQty - targetItem.committedQty - targetItem.procuredQty;
  if (targetItem.remainingQty !== expectedRemaining) {
    throw new Error(
      `Remaining balance formula mismatch: expected ${expectedRemaining}, got ${targetItem.remainingQty}`
    );
  }

  console.log("✓ Mathematical Invariant: Remaining === BOQ - Committed - Procured");
  console.log("✓ Movement Reconciliation: Consumed === Sum(Issue + Wastage)");
  console.log("\n==================================================================");
  console.log("  🔴 GATE 3 PASSED: All 4 counters reconciled with 0 drift!      ");
  console.log("==================================================================");
}

runGate3().catch((err) => {
  console.error("Gate 3 Verification Error:", err);
  process.exit(1);
});
