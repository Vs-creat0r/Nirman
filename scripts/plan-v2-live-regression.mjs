/**
 * @fileoverview S1-08 Plan v2 Accounting & Lifecycle Live Regression Suite
 *
 * Runs against the live running Convex deployment (https://posh-corgi-393.convex.cloud)
 * executing real database arithmetic and status closures across:
 * - Case 7:   committedQty increment on CC-generated PO
 * - Case 8:   Partial delivery double-count prevention (40 + 60 = 100)
 * - Case 9:   Duplicate PO prevention guard on cost comparisons
 * - Case 10:  PO cancellation releases 100% commitment back to 0
 * - Case 10b: Short-close PO accounting (100 ordered, 40 received, short-close -> procuredQty=40, committedQty=0)
 * - Case 11:  Full delivery auto-close (PO closed as fully_received, MR delivered)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function uploadPhotoProof(adminToken) {
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, { token: adminToken });
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: Buffer.from("proof-delivery-photo-jpeg"),
  });
  const { storageId } = await uploadRes.json();
  return storageId;
}

async function main() {
  console.log("================================================================================");
  console.log("   NIRMAN ERP — S1-08 PLAN V2 PROCUREMENT ACCOUNTING LIVE REGRESSION");
  console.log(`   Target Backend: ${CONVEX_URL}`);
  console.log("================================================================================\n");

  const results = [];

  // 1. Authenticate
  console.log("\n[1/7] Authenticating...");
  const adminToken = await client.action(api.auth.login, {
    username: "admin",
    password: "admin123",
  });

  console.log("  ✔ Admin session established.");

  // 2. Fetch or Create Active Project & Site
  console.log("[2/6] Preparing test Project & Site fixtures...");
  const allProjects = await client.query(api.projects.listAllProjects, { token: adminToken });
  let project = allProjects.find((p) => p.code === "NHT-001") || allProjects[0];
  if (!project) {
    const pId = await client.mutation(api.projects.createProject, {
      name: "Plan V2 Project",
      code: "PV2-PROJ",
      status: "active",
      token: adminToken,
    });
    project = await client.query(api.projects.getProject, { id: pId, token: adminToken });
  }

  const allSites = await client.query(api.sites.listAllSites, { projectId: project._id, token: adminToken });
  let site = allSites[0];
  if (!site) {
    const sId = await client.mutation(api.sites.createSite, {
      name: "Plan V2 Site Alpha",
      code: "PV2-S1",
      projectId: project._id,
      status: "active",
      token: adminToken,
    });
    site = await client.query(api.sites.getSite, { id: sId, token: adminToken });
  }

  // Ensure 2 vendors exist for CC comparison
  const allVendors = await client.query(api.vendors.listVendors, { token: adminToken });
  let vendor1 = allVendors[0];
  if (!vendor1) {
    const vId = await client.mutation(api.vendors.createVendor, {
      name: "BuildCore Supplies Pvt Ltd",
      contactPerson: "Rajesh Kumar",
      phone: "9876543210",
      email: "vendor1@buildcore.com",
      tradeCategories: ["Structural Steel", "Cement"],
      token: adminToken,
    });
    vendor1 = await client.query(api.vendors.getVendor, { id: vId, token: adminToken });
  }

  let vendor2 = allVendors[1];
  if (!vendor2) {
    const vId = await client.mutation(api.vendors.createVendor, {
      name: "Apex Material Solutions Ltd",
      contactPerson: "Sunil Verma",
      phone: "9876543219",
      email: "vendor2@apexmaterials.com",
      tradeCategories: ["Structural Steel", "Cement"],
      token: adminToken,
    });
    vendor2 = await client.query(api.vendors.getVendor, { id: vId, token: adminToken });
  }

  const vendor = vendor1;

  console.log(`  ✔ Target Project: ${project.name} (${project._id})`);
  console.log(`  ✔ Target Site:    ${site.name} (${site._id})`);
  console.log(`  ✔ Vendor 1:       ${vendor1.name} (${vendor1._id})`);
  console.log(`  ✔ Vendor 2:       ${vendor2.name} (${vendor2._id})`);

  // Helper function to create a complete MR -> CC flow
  async function createApprovedMRAndCC(itemDoc, qty, unit, rate) {
    const itemName = itemDoc.name || itemDoc.itemName;
    const mrRes = await client.mutation(api.material_requests.createMR, {
      projectId: project._id,
      siteId: site._id,
      items: [
        {
          itemName,
          quantity: qty,
          unit,
          projectItemId: itemDoc._id,
        },
      ],
      priority: "normal",
      token: adminToken,
    });
    const mrId = mrRes?.id || mrRes;

    const ccRes = await client.mutation(api.cost_comparisons.createCC, {
      materialRequestId: mrId,
      vendorQuotes: [
        {
          vendorId: vendor1._id,
          items: [{ itemName, rate, quantity: qty, unit, projectItemId: itemDoc._id }],
          taxRate: 18,
          paymentTerms: "30 days net",
          freight: 0,
        },
        {
          vendorId: vendor2._id,
          items: [{ itemName, rate: rate * 1.1, quantity: qty, unit, projectItemId: itemDoc._id }],
          taxRate: 18,
          paymentTerms: "30 days net",
          freight: 0,
        },
      ],
      submitImmediately: true,
      token: adminToken,
    });

    await client.mutation(api.cost_comparisons.approveCC, {
      id: ccRes.id,
      selectedVendorId: vendor1._id,
      token: adminToken,
    });

    return { mrId, ccId: ccRes.id };
  }

  async function getProjectItem(itemId) {
    const items = await client.query(api.project_items.listProjectItems, {
      projectId: project._id,
      token: adminToken,
    });
    return items.find((i) => i._id === itemId);
  }

  // ── TEST SUITE ─────────────────────────────────────────────────────────────
  console.log("\n[3/6] Running Test: Case 7 (committedQty on PO Creation) & Case 9 (Duplicate PO Guard)...");

  // 1. Create BOQ item for Case 7 & 9
  const itemA_Id = await client.mutation(api.project_items.createProjectItem, {
    projectId: project._id,
    itemName: `Cement Grade 53 (Test-7-${Date.now()})`,
    category: "Cement",
    unit: "bags",
    boqQty: 500,
    estimatedRate: 400,
    token: adminToken,
  });
  let itemA = await getProjectItem(itemA_Id);

  const { mrId: mrA_Id, ccId: ccA_Id } = await createApprovedMRAndCC(itemA, 100, "bags", 390);

  // Generate PO from CC
  const poA_Res = await client.mutation(api.purchase_orders.createPOFromCC, {
    costComparisonId: ccA_Id,
    token: adminToken,
  });

  // Verify item committedQty
  itemA = await getProjectItem(itemA_Id);
  const case7Passed = itemA.committedQty === 100 && (itemA.procuredQty || 0) === 0;
  results.push({
    name: "Case 7: committedQty on PO Creation",
    passed: case7Passed,
    details: { committedQty: itemA.committedQty, procuredQty: itemA.procuredQty },
  });
  console.log(case7Passed ? `  ✔ [PASS] Case 7: committedQty = 100, procuredQty = 0` : `  ❌ [FAIL] Case 7`);

  // Test Case 9: Duplicate PO rejection
  let case9Passed = false;
  try {
    await client.mutation(api.purchase_orders.createPOFromCC, {
      costComparisonId: ccA_Id,
      token: adminToken,
    });
  } catch (err) {
    case9Passed = String(err).includes("already exists") || String(err).includes("Purchase Order already created") || String(err).includes("already");
  }
  results.push({ name: "Case 9: Reject Duplicate PO from CC", passed: case9Passed });
  console.log(case9Passed ? `  ✔ [PASS] Case 9: Duplicate PO creation strictly rejected` : `  ❌ [FAIL] Case 9`);

  // ── TEST CASE 8 & 11: PARTIAL DELIVERY & FULL DELIVERY AUTO-CLOSE ──────────
  console.log("\n[4/6] Running Test: Case 8 (Partial Delivery Double-Count Guard) & Case 11 (Full Delivery Auto-Close)...");

  const todayStr = new Date().toISOString().split("T")[0];

  // Batch 1: Dispatch 40 bags, Receive 40 bags
  const photo1 = await uploadPhotoProof(adminToken);
  const dc1 = await client.mutation(api.delivery_challans.createDC, {
    purchaseOrderId: poA_Res.id,
    dispatchedItems: [{ itemName: itemA.name, orderedQty: 100, dispatchedQty: 40, unit: "bags" }],
    vehicleNo: "KA-01-AB-1234",
    driverName: "Suresh Driver",
    driverPhone: "9876543211",
    dispatchDate: todayStr,
    expectedArrival: todayStr,
    token: adminToken,
  });

  await client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
    deliveryChallanId: dc1.id,
    receivedItems: [{ itemName: itemA.name, receivedQty: 40, expectedQty: 40, unit: "bags" }],
    photos: [photo1],
    token: adminToken,
  });

  itemA = await getProjectItem(itemA_Id);
  const batch1Passed = itemA.procuredQty === 40 && itemA.committedQty === 60;
  console.log(`  ✔ Batch 1 Partial GRN (40 bags): procuredQty = ${itemA.procuredQty}, committedQty = ${itemA.committedQty}`);

  // Batch 2: Dispatch remaining 60 bags, Receive 60 bags
  const photo2 = await uploadPhotoProof(adminToken);
  const dc2 = await client.mutation(api.delivery_challans.createDC, {
    purchaseOrderId: poA_Res.id,
    dispatchedItems: [{ itemName: itemA.name, orderedQty: 60, dispatchedQty: 60, unit: "bags" }],
    vehicleNo: "KA-01-AB-5678",
    driverName: "Ramesh Driver",
    driverPhone: "9876543212",
    dispatchDate: todayStr,
    expectedArrival: todayStr,
    token: adminToken,
  });

  await client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
    deliveryChallanId: dc2.id,
    receivedItems: [{ itemName: itemA.name, receivedQty: 60, expectedQty: 60, unit: "bags" }],
    photos: [photo2],
    token: adminToken,
  });

  itemA = await getProjectItem(itemA_Id);
  const case8Passed = batch1Passed && itemA.procuredQty === 100 && itemA.committedQty === 0;
  results.push({
    name: "Case 8: Partial Delivery Double-Count Prevention",
    passed: case8Passed,
    details: { procuredQty: itemA.procuredQty, committedQty: itemA.committedQty },
  });
  console.log(case8Passed ? `  ✔ [PASS] Case 8: Final procuredQty strictly equals 100 (40+60), committedQty = 0` : `  ❌ [FAIL] Case 8`);

  // Verify Case 11: PO and MR auto-closed
  const finalPO_A = await client.query(api.purchase_orders.getPO, { id: poA_Res.id, token: adminToken });
  const finalMR_A = await client.query(api.material_requests.getMR, { id: mrA_Id, token: adminToken });

  const case11Passed =
    finalPO_A.status === "closed" &&
    finalPO_A.closureType === "fully_received" &&
    finalMR_A.status === "delivered";

  results.push({
    name: "Case 11: Full Delivery Auto-Close (PO & MR)",
    passed: case11Passed,
    details: { poStatus: finalPO_A.status, poClosure: finalPO_A.closureType, mrStatus: finalMR_A.status },
  });
  console.log(case11Passed ? `  ✔ [PASS] Case 11: PO auto-closed (${finalPO_A.closureType}), MR auto-delivered` : `  ❌ [FAIL] Case 11`);

  // ── TEST CASE 10b: SHORT CLOSE ACCOUNTING ──────────────────────────────────
  console.log("\n[5/6] Running Test: Case 10b (Short-Close PO Accounting)...");

  const itemB_Id = await client.mutation(api.project_items.createProjectItem, {
    projectId: project._id,
    itemName: `Structural Steel Rebar (Test-10b-${Date.now()})`,
    category: "Steel",
    unit: "tonnes",
    boqQty: 200,
    estimatedRate: 65000,
    token: adminToken,
  });
  let itemB = await getProjectItem(itemB_Id);

  const { mrId: mrB_Id, ccId: ccB_Id } = await createApprovedMRAndCC(itemB, 100, "tonnes", 64000);
  const poB_Res = await client.mutation(api.purchase_orders.createPOFromCC, {
    costComparisonId: ccB_Id,
    token: adminToken,
  });

  // Receive 40 tonnes out of 100
  const photoB = await uploadPhotoProof(adminToken);
  const dcB = await client.mutation(api.delivery_challans.createDC, {
    purchaseOrderId: poB_Res.id,
    dispatchedItems: [{ itemName: itemB.name, orderedQty: 100, dispatchedQty: 40, unit: "tonnes" }],
    vehicleNo: "KA-01-ST-9999",
    driverName: "Kailash Driver",
    driverPhone: "9876543213",
    dispatchDate: todayStr,
    expectedArrival: todayStr,
    token: adminToken,
  });

  await client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
    deliveryChallanId: dcB.id,
    receivedItems: [{ itemName: itemB.name, receivedQty: 40, expectedQty: 40, unit: "tonnes" }],
    photos: [photoB],
    token: adminToken,
  });

  // Short close remaining 60 tonnes
  await client.mutation(api.purchase_order_closure.cancelPO, {
    id: poB_Res.id,
    reason: "Supplier out of stock, short closing remainder",
    token: adminToken,
  });

  itemB = await getProjectItem(itemB_Id);
  const finalPO_B = await client.query(api.purchase_orders.getPO, { id: poB_Res.id, token: adminToken });

  const case10bPassed =
    finalPO_B.status === "closed" &&
    finalPO_B.closureType === "short_closed" &&
    itemB.procuredQty === 40 &&
    itemB.committedQty === 0;

  results.push({
    name: "Case 10b: Short-Close PO Accounting",
    passed: case10bPassed,
    details: {
      poStatus: finalPO_B.status,
      closureType: finalPO_B.closureType,
      procuredQty: itemB.procuredQty,
      committedQty: itemB.committedQty,
    },
  });
  console.log(
    case10bPassed
      ? `  ✔ [PASS] Case 10b: Short-close: procuredQty = 40 (kept), committedQty = 0 (released 60), PO status = closed (short_closed)`
      : `  ❌ [FAIL] Case 10b`
  );

  // ── TEST CASE 10: FULL PO CANCEL AND UNWIND ────────────────────────────────
  console.log("\n[6/6] Running Test: Case 10 (Full PO Cancel and Commitment Unwind)...");

  const itemC_Id = await client.mutation(api.project_items.createProjectItem, {
    projectId: project._id,
    itemName: `Sand River (Test-10-${Date.now()})`,
    category: "Aggregates",
    unit: "cum",
    boqQty: 100,
    estimatedRate: 1500,
    token: adminToken,
  });
  let itemC = await getProjectItem(itemC_Id);

  const { mrId: mrC_Id, ccId: ccC_Id } = await createApprovedMRAndCC(itemC, 50, "cum", 1450);
  const poC_Res = await client.mutation(api.purchase_orders.createPOFromCC, {
    costComparisonId: ccC_Id,
    token: adminToken,
  });

  itemC = await getProjectItem(itemC_Id);
  const itemC_InitialCommitment = itemC.committedQty === 50;

  // Cancel with zero deliveries
  await client.mutation(api.purchase_order_closure.cancelPO, {
    id: poC_Res.id,
    reason: "Wrong material specs ordered, cancelling",
    token: adminToken,
  });

  itemC = await getProjectItem(itemC_Id);
  const finalPO_C = await client.query(api.purchase_orders.getPO, { id: poC_Res.id, token: adminToken });
  const finalMR_C = await client.query(api.material_requests.getMR, { id: mrC_Id, token: adminToken });

  const case10Passed =
    itemC_InitialCommitment &&
    finalPO_C.status === "cancelled" &&
    finalPO_C.closureType === "cancelled" &&
    itemC.committedQty === 0 &&
    (itemC.procuredQty || 0) === 0 &&
    finalMR_C.status === "ready_for_po";

  results.push({
    name: "Case 10: Full PO Cancel & Regenerate Reset",
    passed: case10Passed,
    details: {
      poStatus: finalPO_C.status,
      mrStatus: finalMR_C.status,
      committedQty: itemC.committedQty,
    },
  });
  console.log(
    case10Passed
      ? `  ✔ [PASS] Case 10: Full cancel: PO = cancelled, committedQty = 0, MR returned to ready_for_po`
      : `  ❌ [FAIL] Case 10`
  );

  // Summary
  console.log("\n================================================================================");
  const allPassed = results.every((r) => r.passed);
  console.log(`   SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} assertions PASSED`);
  if (allPassed) {
    console.log("   🔴 GATE 3 LIVE ACCOUNTING REGRESSION: PASSED ✔");
  } else {
    console.log("   🔴 GATE 3 LIVE ACCOUNTING REGRESSION: FAILED ❌");
  }
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during Plan v2 live regression:", err);
  process.exit(1);
});
