/**
 * @fileoverview S1-11 Gate 4 - Four-Role End-to-End Procurement Lifecycle Run
 *
 * Exercises the full MR -> CC -> PO -> DC -> GRN pipeline using four separate
 * authenticated sessions, asserting:
 *   1.  Admin assigns project to all four roles  (setup)
 *   2.  Site Supervisor creates and submits an MR
 *   3.  Project Manager approves the MR
 *   4.  Procurement Officer creates a CC (no amount field - server computes it)
 *   5.  Procurement Officer submits the CC
 *   6.  Project Manager approves the CC selecting a vendor
 *   7.  Procurement Officer creates a PO from the approved CC
 *   8.  Procurement Officer submits the PO
 *   9.  Project Manager approves the PO
 *   10. Procurement Officer creates a Delivery Challan
 *   11. Site Supervisor uploads photo proof and confirms delivery (GRN)
 *   12. Assert MR final status is "delivered"
 *   13. Scoping isolation: SS list cannot surface the MR above from another role
 *
 * Usage: node scripts/gate4-e2e-four-role-run.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

let passCount = 0, failCount = 0;
const failures = [];

function assert(label, condition, extra) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passCount++;
  } else {
    const msg = extra ? ` -- ${extra}` : "";
    console.log(`  [FAIL] ${label}${msg}`);
    failCount++;
    failures.push(label);
  }
}

async function uploadPhotoProof(token) {
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, { token });
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: Buffer.from("gate4-proof-jpeg"),
  });
  const { storageId } = await res.json();
  return storageId;
}

async function login(username, password) {
  return await client.action(api.auth.login, { username, password });
}


async function main() {
  console.log("================================================================================");
  console.log("  NIRMAN ERP -- S1-11 GATE 4: FOUR-ROLE END-TO-END LIFECYCLE RUN");
  console.log(`  Target: ${CONVEX_URL}`);
  console.log("================================================================================\n");

  // -- Authenticate all four roles
  console.log("[SETUP] Authenticating four roles...");
  const adminToken = await login("admin", "admin123");
  const pmToken    = await login("manager", "manager123");
  const poToken    = await login("procurement", "procurement123");
  const ssToken    = await login("supervisor", "supervisor123");
  assert("Admin login", !!adminToken);
  assert("Project Manager login", !!pmToken);
  assert("Procurement Officer login", !!poToken);
  assert("Site Supervisor login", !!ssToken);

  // Resolve resource IDs
  const allProjects = await client.query(api.projects.listProjects, { token: adminToken });
  if (!allProjects.length) { console.error("[FATAL] No projects."); process.exit(1); }
  const project = allProjects[0];
  console.log(`  Project: ${project.name} (${project._id})`);

  const sites = await client.query(api.sites.listSites, { projectId: project._id, token: adminToken });
  const site = sites[0] || null;
  if (site) console.log(`  Site:    ${site.name} (${site._id})`);

  const vendors = await client.query(api.vendors.listVendors, { token: adminToken });
  if (vendors.length < 2) { console.error("[FATAL] Need >=2 vendors."); process.exit(1); }
  const [vendor1, vendor2] = vendors;

  // Resolve user IDs for assignment
  const allUsers = await client.query(api.users.list, { token: adminToken });
  const pmUser = allUsers.find(u => u.username === "manager");
  const poUser = allUsers.find(u => u.username === "procurement");
  const ssUser = allUsers.find(u => u.username === "supervisor");

  // -- SETUP: Assign project (and site for SS) to all non-admin users
  console.log("\n[SETUP] Admin assigns project scoping...");
  const siteIds = site ? [site._id] : [];
  try {
    await client.mutation(api.users.updateUserAssignments, {
      userId: pmUser._id, assignedProjectIds: [project._id], assignedSiteIds: [], token: adminToken,
    });
    assert("Admin assigns PM to project", true);
  } catch (e) { assert("Admin assigns PM to project", false, e.message); }

  try {
    await client.mutation(api.users.updateUserAssignments, {
      userId: poUser._id, assignedProjectIds: [project._id], assignedSiteIds: [], token: adminToken,
    });
    assert("Admin assigns PO to project", true);
  } catch (e) { assert("Admin assigns PO to project", false, e.message); }

  try {
    await client.mutation(api.users.updateUserAssignments, {
      userId: ssUser._id, assignedProjectIds: [], assignedSiteIds: siteIds, token: adminToken,
    });
    assert("Admin assigns SS to site", true);
  } catch (e) { assert("Admin assigns SS to site", false, e.message); }

  // -- 1. Site Supervisor creates MR
  console.log("\n[1/8] Site Supervisor creates Material Request...");
  let mrId;
  try {
    const result = await client.mutation(api.material_requests.createMR, {
      projectId: project._id,
      siteId: site?._id,
      items: [{ itemName: "G4E2E-Cement", quantity: 50, unit: "bags" }],
      priority: "high",
      requiredBy: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      token: ssToken,
    });
    mrId = result.id || result;
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("SS creates MR", !!mrId, mr?.refNo);
  } catch (e) { assert("SS creates MR", false, e.message); process.exit(1); }

  try {
    await client.mutation(api.material_requests.submitMR, { id: mrId, token: ssToken });
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("SS submits MR -> pending", mr?.status === "pending");
  } catch (e) { assert("SS submits MR", false, e.message); }

  // -- 2. Project Manager approves MR
  console.log("\n[2/8] Project Manager approves Material Request...");
  try {
    await client.mutation(api.material_requests.approveMR, { id: mrId, token: pmToken });
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("PM approves MR -> ready_for_cc", mr?.status === "ready_for_cc");
  } catch (e) { assert("PM approves MR", false, e.message); }

  // -- 3. Procurement Officer creates CC
  console.log("\n[3/8] Procurement Officer creates Cost Comparison (2 vendors)...");
  let ccId;
  try {
    const result = await client.mutation(api.cost_comparisons.createCC, {
      materialRequestId: mrId,
      vendorQuotes: [
        {
          vendorId: vendor1._id,
          items: [{ itemName: "G4E2E-Cement", quantity: 50, unit: "bags", rate: 350 }],
          taxRate: 18,
        },
        {
          vendorId: vendor2._id,
          items: [{ itemName: "G4E2E-Cement", quantity: 50, unit: "bags", rate: 320 }],
          taxRate: 18,
        },
      ],
      token: poToken,
    });
    ccId = result.id || result;
    const cc = await client.query(api.cost_comparisons.getCC, { id: ccId, token: adminToken });
    assert("PO creates CC", !!ccId, cc?.refNo);
  } catch (e) { assert("PO creates CC", false, e.message); process.exit(1); }

  try {
    await client.mutation(api.cost_comparisons.submitCC, { id: ccId, token: poToken });
    const cc = await client.query(api.cost_comparisons.getCC, { id: ccId, token: adminToken });
    assert("PO submits CC -> submitted", cc?.status === "submitted");
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("MR advances to review_cc", mr?.status === "review_cc");
  } catch (e) { assert("PO submits CC", false, e.message); }

  // -- 4. Project Manager approves CC
  console.log("\n[4/8] Project Manager approves CC (vendor2 = lowest price)...");
  try {
    await client.mutation(api.cost_comparisons.approveCC, {
      id: ccId,
      selectedVendorId: vendor2._id,
      selectionJustification: "Gate 4 E2E -- lowest quoted price",
      token: pmToken,
    });
    const cc = await client.query(api.cost_comparisons.getCC, { id: ccId, token: adminToken });
    assert("PM approves CC -> approved", cc?.status === "approved");
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("MR advances to ready_for_po", mr?.status === "ready_for_po");
  } catch (e) { assert("PM approves CC", false, e.message); }

  // -- 5. Procurement Officer creates PO from CC
  console.log("\n[5/8] Procurement Officer creates PO from approved CC...");
  let poId;
  try {
    const result = await client.mutation(api.purchase_orders.createPOFromCC, {
      costComparisonId: ccId,
      paymentTerms: "30_days",
      token: poToken,
    });
    poId = result.id || result;
    const po = await client.query(api.purchase_orders.getPO, { id: poId, token: adminToken });
    assert("PO creates PO from CC", !!poId, po?.refNo);
    assert("PO -> draft", po?.status === "draft");
  } catch (e) { assert("PO creates PO from CC", false, e.message); process.exit(1); }

  try {
    await client.mutation(api.purchase_orders.submitPO, { id: poId, token: poToken });
    const po = await client.query(api.purchase_orders.getPO, { id: poId, token: adminToken });
    assert("PO submits PO -> submitted", po?.status === "submitted");
  } catch (e) { assert("PO submits PO", false, e.message); }

  // -- 6. Project Manager approves PO
  console.log("\n[6/8] Project Manager approves PO...");
  try {
    await client.mutation(api.purchase_order_approvals.approvePO, { id: poId, token: pmToken });
    const po = await client.query(api.purchase_orders.getPO, { id: poId, token: adminToken });
    assert("PM approves PO -> approved", po?.status === "approved");
  } catch (e) { assert("PM approves PO", false, e.message); }

  // -- 7. Procurement Officer creates Delivery Challan
  console.log("\n[7/8] Procurement Officer creates Delivery Challan...");
  let dcId;
  try {
    const result = await client.mutation(api.delivery_challans.createDC, {
      purchaseOrderId: poId,
      vehicleNo: "GJ-01-G4-9999",
      driverName: "Gate4 Driver",
      dispatchedItems: [{ itemName: "G4E2E-Cement", orderedQty: 50, dispatchedQty: 50, unit: "bags" }],
      dispatchDate: new Date().toISOString().split("T")[0],
      expectedArrival: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      token: poToken,
    });
    dcId = result.id || result;
    const dc = await client.query(api.delivery_challans.getDC, { id: dcId, token: adminToken });
    assert("PO creates DC", !!dcId, dc?.refNo);
    assert("DC -> delivery_processing", dc?.status === "delivery_processing");
    const mr = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("MR -> delivery_processing", mr?.status === "delivery_processing");
  } catch (e) { assert("PO creates DC", false, e.message); process.exit(1); }

  // -- 8. Site Supervisor confirms delivery with photo proof
  console.log("\n[8/8] Site Supervisor confirms delivery (GRN with photo proof)...");
  try {
    const photoId = await uploadPhotoProof(ssToken);
    assert("SS uploads photo proof (storageId resolves)", !!photoId);

    const result = await client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
      deliveryChallanId: dcId,
      receivedItems: [{ itemName: "G4E2E-Cement", expectedQty: 50, receivedQty: 50, unit: "bags" }],
      photos: [photoId],
      invoiceNumber: "INV-GATE4-001",
      token: ssToken,
    });
    assert("SS confirms delivery -> GRN generated", !!result);

    const mrFinal = await client.query(api.material_requests.getMR, { id: mrId, token: adminToken });
    assert("MR final status is delivered", mrFinal?.status === "delivered");

    const dcFinal = await client.query(api.delivery_challans.getDC, { id: dcId, token: adminToken });
    assert("DC final status is delivered", dcFinal?.status === "delivered");

    const poFinal = await client.query(api.purchase_orders.getPO, { id: poId, token: adminToken });
    assert("PO final status is closed (fully_received)", poFinal?.status === "closed");
  } catch (e) { assert("SS confirms delivery (GRN)", false, e.message); }

  // -- Scoping isolation
  console.log("\n[BONUS] Scoping isolation: SS list MRs returns only own-site docs...");
  try {
    const ssMRs = await client.query(api.material_requests.listMRs, { token: ssToken });
    const ownMR = ssMRs.find(mr => String(mr._id) === String(mrId));
    assert("SS sees own MR in list", !!ownMR);
    const leakCheck = ssMRs.every(mr => !mr.siteId || String(mr.siteId) === String(site?._id));
    assert("SS list contains only own-site MRs (no cross-site leak)", leakCheck);
  } catch (e) { assert("Scoping isolation check", false, e.message); }

  // -- Summary
  console.log("\n================================================================================");
  console.log(`  GATE 4: ${passCount} PASSED, ${failCount} FAILED`);
  if (failures.length) {
    console.log("  FAILURES:");
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log("================================================================================\n");
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => { console.error("[FATAL]", e); process.exit(1); });
