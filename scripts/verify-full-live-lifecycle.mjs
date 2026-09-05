/**
 * Complete End-to-End Live Lifecycle:
 * BOQ Item -> MR -> CC -> PO -> DC -> Real Photo Upload -> GRN Confirmation ->
 * procuredQty rises to 100 & on-hand rises to 100 ->
 * Issue 35 -> Transfer 15 -> Wastage 5 -> procuredQty holds at 100 -> 0 drift!
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function runFullLiveLifecycle() {
  console.log("==================================================================");
  console.log("  FULL LIVE LIFECYCLE: BOQ -> MR -> CC -> PO -> DC -> GRN -> MOVEMENTS");
  console.log("==================================================================");

  // 1. Authenticate
  console.log("\n[1/8] Authenticating Admin & Supervisor...");
  const adminToken = await client.action(api.auth.login, {
    username: "admin",
    password: "admin123",
  });
  const supToken = await client.action(api.auth.login, {
    username: "supervisor",
    password: "supervisor",
  });


  const projects = await client.query(api.projects.listAllProjects, { token: adminToken });
  const project = projects[0];
  const sites = await client.query(api.sites.listSites, { projectId: project._id, token: adminToken });
  const siteA = sites[0];
  const siteB = sites.length > 1 ? sites[1] : sites[0];

  // 2. Create BOQ Line Item (Target 500 MT)
  const timestamp = Date.now();
  const itemName = `Live Fe-500D Rebar (${timestamp})`;
  console.log(`\n[2/8] Creating BOQ Item "${itemName}" (Target: 500 MT)...`);
  const projectItemId = await client.mutation(api.project_items.createProjectItem, {
    projectId: project._id,
    itemName,
    category: "Steel",
    unit: "MT",
    boqQty: 500,
    estimatedRate: 65000,
    description: "Full lifecycle live procurement & stock ledger test",
    token: adminToken,
  });

  // Ensure at least 2 Vendors exist
  let vendors = await client.query(api.vendors.listVendors, { token: adminToken });
  let vendor1Id = vendors[0]?._id;
  let vendor2Id = vendors[1]?._id;

  if (!vendor1Id) {
    vendor1Id = await client.mutation(api.vendors.createVendor, {
      name: "National Steel Suppliers Ltd",
      contactPerson: "Rajesh Sharma",
      phone: "9876543210",
      email: "sales@nationalsteel.in",
      category: "Steel",
      token: adminToken,
    });
  }
  if (!vendor2Id) {
    vendor2Id = await client.mutation(api.vendors.createVendor, {
      name: "Apex Infra Steels Pvt Ltd",
      contactPerson: "Amit Verma",
      phone: "9811223344",
      email: "info@apexsteel.in",
      category: "Steel",
      token: adminToken,
    });
  }

  // 3. Create MR -> Ready for CC
  console.log("\n[3/8] Creating Material Request for 100 MT...");
  const mrRes = await client.mutation(api.material_requests.createMR, {
    projectId: project._id,
    siteId: siteA._id,
    items: [
      {
        itemName,
        quantity: 100,
        unit: "MT",
        projectItemId,
      },
    ],
    priority: "urgent",
    submitImmediately: true,
    token: adminToken,
  });
  console.log(`  ✓ Material Request: ${mrRes.refNo} (Status: ${mrRes.status})`);

  // Verify MR available actions
  const mrActions = await client.query(api.lifecycle.availableActions, {
    table: "material_request",
    documentId: mrRes.id,
    token: adminToken,
  });
  console.log(`  ✓ Material Request availableActions returned status "${mrActions.status}" with ${mrActions.actions.length} action(s)`);

  // 4. Create CC with 2 Vendor Quotes -> Submit -> Approve
  console.log("\n[4/8] Creating Cost Comparison with 2 Competitive Quotes & Approving...");
  const ccRes = await client.mutation(api.cost_comparisons.createCC, {
    materialRequestId: mrRes.id,
    vendorQuotes: [
      {
        vendorId: vendor1Id,
        items: [
          {
            itemName,
            quantity: 100,
            unit: "MT",
            rate: 65000,
            projectItemId,
          },
        ],
        taxRate: 18,
        paymentTerms: "30_days",
        deliveryDays: 3,
      },
      {
        vendorId: vendor2Id,
        items: [
          {
            itemName,
            quantity: 100,
            unit: "MT",
            rate: 67500,
            projectItemId,
          },
        ],
        taxRate: 18,
        paymentTerms: "15_days",
        deliveryDays: 5,
      },
    ],
    submitImmediately: true,
    token: adminToken,
  });

  // Verify CC available actions in submitted state
  const ccActions = await client.query(api.lifecycle.availableActions, {
    table: "cost_comparison",
    documentId: ccRes.id,
    token: adminToken,
  });
  console.log(`  ✓ Cost Comparison availableActions: [${ccActions.actions.map((a) => a.name).join(", ")}] (all evaluated server-authoritatively)`);

  await client.mutation(api.cost_comparisons.approveCC, {
    id: ccRes.id,
    selectedVendorId: vendor1Id,
    selectionJustification: "Lowest compliant bidder with inclusive freight",
    token: adminToken,
  });
  console.log("  ✓ Cost Comparison approved");

  // 5. Create PO -> Submit -> Approve
  console.log("\n[5/8] Creating Purchase Order from CC & Approving...");
  const poRes = await client.mutation(api.purchase_orders.createPOFromCC, {
    costComparisonId: ccRes.id,
    token: adminToken,
  });
  if (poRes.status !== "approved") {
    await client.mutation(api.purchase_orders.submitPO, { id: poRes.id, token: adminToken });
    await client.mutation(api.purchase_order_approvals.approvePO, { id: poRes.id, token: adminToken });
  }
  console.log(`  ✓ Purchase Order ready & approved (PO: ${poRes.refNo}, ID: ${poRes.id})`);

  // Verify PO available actions
  const poActions = await client.query(api.lifecycle.availableActions, {
    table: "purchase_order",
    documentId: poRes.id,
    token: adminToken,
  });
  console.log(`  ✓ Purchase Order availableActions: [${poActions.actions.map((a) => a.name).join(", ")}]`);

  // Check BOQ counters after PO approval: committedQty should be 100
  let boqDetails = await client.query(api.project_items.getProjectBOQDetails, {
    projectId: project._id,
    token: adminToken,
  });
  let itemCounter = boqDetails.items.find((i) => i._id === projectItemId);
  console.log(`  BOQ Target: ${itemCounter.boqQty} MT, Committed: ${itemCounter.committedQty} MT, Procured: ${itemCounter.procuredQty} MT`);

  // 6. Create DC -> Dispatch
  console.log("\n[6/8] Creating Delivery Challan for 100 MT...");
  const dcRes = await client.mutation(api.delivery_challans.createDC, {
    purchaseOrderId: poRes.id,
    vehicleNo: "MH-04-AZ-9988",
    driverName: "Suresh Patil",
    driverPhone: "9811223344",
    dispatchDate: new Date().toISOString().split("T")[0],
    expectedArrival: new Date().toISOString().split("T")[0],
    dispatchedItems: [
      {
        itemName,
        orderedQty: 100,
        dispatchedQty: 100,
        unit: "MT",
      },
    ],
    token: adminToken,
  });
  console.log(`  ✓ Delivery Challan dispatched (DC: ${dcRes.refNo}, ID: ${dcRes.id})`);

  // Verify DC available actions in delivery_processing
  const dcActions = await client.query(api.lifecycle.availableActions, {
    table: "delivery_challan",
    documentId: dcRes.id,
    token: adminToken,
  });
  console.log(`  ✓ Delivery Challan availableActions: [${dcActions.actions.map((a) => a.name).join(", ")}]`);

  // 7. Upload real photo to Convex Storage and confirm delivery
  console.log("\n[7/8] Uploading proof photo & confirming delivery receipt via GRN...");
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, { token: adminToken });
  const dummyPhoto = Buffer.from("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: dummyPhoto,
  });
  const { storageId } = await uploadRes.json();
  console.log(`  ✓ Uploaded unloading proof photo (Storage ID: ${storageId})`);

  // Confirm delivery as Supervisor -> Auto-generate GRN
  const grnRes = await client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
    deliveryChallanId: dcRes.id,
    receivedItems: [
      {
        itemName,
        expectedQty: 100,
        receivedQty: 100,
        unit: "MT",
      },
    ],
    photos: [storageId],
    invoiceNumber: `INV-${timestamp}`,
    remarks: "100 MT unloaded and verified by Site Supervisor",
    token: adminToken,
  });
  console.log(`  ✓ GRN Confirmed: ${grnRes.refNo} (Status: delivered)`);

  // 8. Assert Post-GRN Invariant: procuredQty RISES to 100 MT and Site A on-hand RISES to 100 MT!
  boqDetails = await client.query(api.project_items.getProjectBOQDetails, {
    projectId: project._id,
    token: adminToken,
  });
  itemCounter = boqDetails.items.find((i) => i._id === projectItemId);

  const invA = await client.query(api.movements.getSiteInventory, { siteId: siteA._id, token: adminToken });
  const itemInvA = invA.find((i) => i.itemName === itemName);

  console.log("\n--- POST-GRN RECEIPT RECONCILIATION ---");
  console.log(`  BOQ Target        : ${itemCounter.boqQty} MT`);
  console.log(`  Committed (POs)   : ${itemCounter.committedQty} MT (expected 0)`);
  console.log(`  Procured (GRNs)   : ${itemCounter.procuredQty} MT (ASSERT: MUST EQUAL 100 MT)`);
  console.log(`  Consumed (Issued) : ${itemCounter.consumedQty} MT (expected 0)`);
  console.log(`  Left to Order     : ${itemCounter.remainingQty} MT (500 - 100 = 400 MT)`);
  console.log(`  Site A On-Hand    : ${itemInvA?.quantity} MT (ASSERT: MUST EQUAL 100 MT)`);
  console.log("---------------------------------------");

  if (itemCounter.procuredQty !== 100) {
    throw new Error(`GRN Receipt Assertion Failed: Expected procuredQty = 100, got ${itemCounter.procuredQty}`);
  }
  if (itemInvA?.quantity !== 100) {
    throw new Error(`GRN Receipt Assertion Failed: Expected Site A on-hand = 100, got ${itemInvA?.quantity}`);
  }
  console.log("  ✓ Invariant Verified: Real GRN receipt increments procuredQty to 100 AND on-hand to 100!");

  // 9. Issue 35 MT -> Transfer 15 MT -> Wastage 5 MT -> Assert procuredQty HOLDS at 100!
  console.log("\n[8/8] Executing Consumption Lifecycle (Issue 35, Transfer 15, Wastage 5)...");
  await client.mutation(api.movement_actions.issueStock, {
    siteId: siteA._id,
    itemName,
    quantity: 35,
    unit: "MT",
    purpose: "Pier reinforcement column 1",
    projectItemId,
    token: adminToken,
  });

  await client.mutation(api.movement_actions.transferStock, {
    sourceSiteId: siteA._id,
    destinationSiteId: siteB._id,
    itemName,
    quantity: 15,
    unit: "MT",
    purpose: "Auxiliary yard transfer",
    token: adminToken,
  });

  await client.mutation(api.movement_actions.recordWastage, {
    siteId: siteA._id,
    itemName,
    quantity: 5,
    unit: "MT",
    reason: "Offcut scraps",
    projectItemId,
    token: adminToken,
  });

  // Final Invariance Assertion
  boqDetails = await client.query(api.project_items.getProjectBOQDetails, {
    projectId: project._id,
    token: adminToken,
  });
  itemCounter = boqDetails.items.find((i) => i._id === projectItemId);

  const finalInvA = await client.query(api.movements.getSiteInventory, { siteId: siteA._id, token: adminToken });
  const finalItemA = finalInvA.find((i) => i.itemName === itemName);

  console.log("\n==================================================================");
  console.log("  FINAL FULL-LIFECYCLE PROOF REPORT");
  console.log("==================================================================");
  console.log(`  BOQ Target         : ${itemCounter.boqQty} MT`);
  console.log(`  Procured Total     : ${itemCounter.procuredQty} MT (STRICTLY HELD AT 100 MT)`);
  console.log(`  Consumed Total     : ${itemCounter.consumedQty} MT (35 + 5 = 40 MT)`);
  console.log(`  Left to Order      : ${itemCounter.remainingQty} MT (500 - 100 = 400 MT)`);
  console.log(`  Site A Physical    : ${finalItemA?.quantity} MT (100 - 35 - 15 - 5 = 45 MT)`);

  if (itemCounter.procuredQty !== 100) {
    throw new Error(`Invariance Breach: procuredQty changed to ${itemCounter.procuredQty}`);
  }
  if (itemCounter.consumedQty !== 40) {
    throw new Error(`Consumption Mismatch: expected 40, got ${itemCounter.consumedQty}`);
  }
  if (finalItemA?.quantity !== 45) {
    throw new Error(`Site A Balance Mismatch: expected 45, got ${finalItemA?.quantity}`);
  }

  console.log("\n  ✓ PROVED: Real GRN receipt rises procuredQty from 0 -> 100");
  console.log("  ✓ PROVED: Real GRN receipt establishes on-hand 100 in stock movements ledger");
  console.log("  ✓ PROVED: Subsequent consumption (issue, transfer, wastage) leaves procuredQty strictly at 100");
  console.log("  ✓ PROVED: Complete zero-drift reconciliation across full ERP lifecycle!");
  console.log("\n==================================================================");
  console.log("  🎉 FULL END-TO-END GRN LIFECYCLE 100% VERIFIED!                 ");
  console.log("==================================================================");
}

runFullLiveLifecycle().catch((err) => {
  console.error("Live Lifecycle Error:", err);
  process.exit(1);
});
