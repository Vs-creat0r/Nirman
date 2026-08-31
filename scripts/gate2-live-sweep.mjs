/**
 * @fileoverview S1-05b Live IDOR Sweep against Real Convex Database (🔴 GATE 2 Proof)
 *
 * Runs against the live running Convex deployment: https://posh-corgi-393.convex.cloud
 * Tests real queries & mutations using a real Site Supervisor session assigned to Site A-1,
 * attempting to access / mutate real documents belonging to Site A-2 / Project Beta.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://posh-corgi-393.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log("================================================================================");
  console.log("   NIRMAN ERP — S1-05b LIVE IDOR SWEEP & 🔴 GATE 2 VERIFICATION");
  console.log(`   Target Backend: ${CONVEX_URL}`);
  console.log("================================================================================\n");

  const results = [];

  // 1. Authenticate as Admin to verify/provision test records
  console.log("[1/5] Authenticating as Admin...");
  const adminToken = await client.mutation(api.auth.login, {
    username: "admin",
    password: "admin123",
  });
  console.log("  ✔ Admin session established.");

  // Fetch or create Project Alpha and Project Beta
  console.log("[2/5] Setting up Project Alpha & Project Beta test fixtures...");
  const allProjects = await client.query(api.projects.listAllProjects, { token: adminToken });
  
  let projAlpha = allProjects.find((p) => p.code === "NHT-001") || allProjects[0];
  if (!projAlpha) {
    const pId = await client.mutation(api.projects.createProject, {
      name: "Gate2 Project Alpha",
      code: "G2-ALPHA",
      status: "active",
      token: adminToken,
    });
    projAlpha = await client.query(api.projects.getProject, { id: pId, token: adminToken });
  }

  let projBeta = allProjects.find((p) => p.code === "G2-BETA");
  if (!projBeta) {
    const pId = await client.mutation(api.projects.createProject, {
      name: "Gate2 Project Beta",
      code: "G2-BETA",
      status: "active",
      token: adminToken,
    });
    projBeta = await client.query(api.projects.getProject, { id: pId, token: adminToken });
  }

  console.log(`  ✔ Project Alpha: ${projAlpha.name} (${projAlpha._id})`);
  console.log(`  ✔ Project Beta:  ${projBeta.name} (${projBeta._id})`);

  // Ensure sites exist: Site Alpha-1, Site Alpha-2, Site Beta-1
  const allSites = await client.query(api.sites.listAllSites, { token: adminToken });
  let siteAlpha1 = allSites.find((s) => s.projectId === projAlpha._id && (s.code === "NHT-S1" || s.code === "G2-S-A1"));
  if (!siteAlpha1) {
    const sId = await client.mutation(api.sites.createSite, {
      projectId: projAlpha._id,
      name: "Site Alpha-1 Foundation",
      code: "G2-S-A1",
      token: adminToken,
    });
    siteAlpha1 = { _id: sId, name: "Site Alpha-1 Foundation", code: "G2-S-A1", projectId: projAlpha._id };
  }

  let siteAlpha2 = allSites.find((s) => s.projectId === projAlpha._id && s._id !== siteAlpha1._id);
  if (!siteAlpha2) {
    const sId = await client.mutation(api.sites.createSite, {
      projectId: projAlpha._id,
      name: "Site Alpha-2 Tower",
      code: "G2-S-A2",
      token: adminToken,
    });
    siteAlpha2 = { _id: sId, name: "Site Alpha-2 Tower", code: "G2-S-A2", projectId: projAlpha._id };
  }

  let siteBeta1 = allSites.find((s) => s.projectId === projBeta._id);
  if (!siteBeta1) {
    const sId = await client.mutation(api.sites.createSite, {
      projectId: projBeta._id,
      name: "Site Beta-1 Main",
      code: "G2-S-B1",
      token: adminToken,
    });
    siteBeta1 = { _id: sId, name: "Site Beta-1 Main", code: "G2-S-B1", projectId: projBeta._id };
  }

  console.log(`  ✔ Site Alpha-1 (Assigned): ${siteAlpha1.name} (${siteAlpha1._id})`);
  console.log(`  ✔ Site Alpha-2 (Foreign Site, Same Project): ${siteAlpha2.name} (${siteAlpha2._id})`);
  console.log(`  ✔ Site Beta-1  (Foreign Project): ${siteBeta1.name} (${siteBeta1._id})`);

  // Ensure Supervisor is assigned STRICTLY to Site Alpha-1
  console.log("[3/5] Assigning Site Supervisor strictly to Site Alpha-1...");
  const users = await client.query(api.users.list, { token: adminToken });
  const supervisorUser = users.find((u) => u.username === "supervisor");
  if (!supervisorUser) {
    throw new Error("Supervisor user not found in database!");
  }

  await client.mutation(api.users.updateUserAssignments, {
    userId: supervisorUser._id,
    assignedProjectIds: [projAlpha._id],
    assignedSiteIds: [siteAlpha1._id],
    token: adminToken,
  });

  const supervisorToken = await client.mutation(api.auth.login, {
    username: "supervisor",
    password: "supervisor123",
  });
  console.log("  ✔ Site Supervisor authenticated with strict Site Alpha-1 scoping.");

  // Provision documents and shared vendor records
  console.log("[4/5] Provisioning documents across scopes with shared vendor...");
  const vendors = await client.query(api.vendors.listVendors, { token: adminToken });
  let sharedVendor = vendors[0];
  let secondVendor = vendors[1] || vendors[0];
  if (!sharedVendor) {
    throw new Error("No vendors found in database!");
  }

  // 1. In-Scope PO under Site Alpha-1 with Shared Vendor (Spend: ₹10,000)
  const mrAlpha1 = await client.mutation(api.material_requests.createMR, {
    projectId: projAlpha._id,
    siteId: siteAlpha1._id,
    items: [{ itemName: "Alpha1 Cement", quantity: 100, unit: "bags" }],
    priority: "normal",
    submitImmediately: true,
    token: adminToken,
  });

  const ccAlpha1 = await client.mutation(api.cost_comparisons.createCC, {
    materialRequestId: mrAlpha1.id,
    vendorQuotes: [
      {
        vendorId: sharedVendor._id,
        items: [{ itemName: "Alpha1 Cement", quantity: 100, unit: "bags", rate: 100 }],
        taxRate: 0,
      },
      {
        vendorId: secondVendor._id,
        items: [{ itemName: "Alpha1 Cement", quantity: 100, unit: "bags", rate: 120 }],
        taxRate: 0,
      },
    ],
    submitImmediately: true,
    token: adminToken,
  });

  await client.mutation(api.cost_comparisons.approveCC, {
    id: ccAlpha1.id,
    selectedVendorId: sharedVendor._id,
    token: adminToken,
  });

  let poAlpha1;
  try {
    poAlpha1 = await client.mutation(api.purchase_orders.createPOFromCC, {
      costComparisonId: ccAlpha1.id,
      token: adminToken,
    });
  } catch (e) {
    // Might already exist
  }

  // 2. Foreign MR under Site Alpha-2 (Same project, foreign site)
  const mrAlpha2 = await client.mutation(api.material_requests.createMR, {
    projectId: projAlpha._id,
    siteId: siteAlpha2._id,
    items: [{ itemName: "Alpha2 Bricks", quantity: 500, unit: "pcs" }],
    priority: "normal",
    token: adminToken,
  });

  // 3. Foreign Documents under Project Beta (MR -> CC -> PO -> DC) with Shared Vendor (Spend: ₹25,000)
  const mrBeta = await client.mutation(api.material_requests.createMR, {
    projectId: projBeta._id,
    siteId: siteBeta1._id,
    items: [{ itemName: "Beta Structural Steel", quantity: 50, unit: "tonnes" }],
    priority: "urgent",
    submitImmediately: true,
    token: adminToken,
  });

  const ccBeta = await client.mutation(api.cost_comparisons.createCC, {
    materialRequestId: mrBeta.id,
    vendorQuotes: [
      {
        vendorId: sharedVendor._id,
        items: [{ itemName: "Beta Structural Steel", quantity: 50, unit: "tonnes", rate: 500 }],
        taxRate: 0,
      },
      {
        vendorId: secondVendor._id,
        items: [{ itemName: "Beta Structural Steel", quantity: 50, unit: "tonnes", rate: 600 }],
        taxRate: 0,
      },
    ],
    submitImmediately: true,
    token: adminToken,
  });

  await client.mutation(api.cost_comparisons.approveCC, {
    id: ccBeta.id,
    selectedVendorId: sharedVendor._id,
    token: adminToken,
  });

  const poBeta = await client.mutation(api.purchase_orders.createPOFromCC, {
    costComparisonId: ccBeta.id,
    token: adminToken,
  });

  const dcBeta = await client.mutation(api.delivery_challans.createDC, {
    purchaseOrderId: poBeta.id,
    vehicleNo: "MH-01-BETA-8888",
    driverName: "Beta Transporter",
    dispatchedItems: [
      {
        itemName: "Beta Structural Steel",
        orderedQty: 50,
        dispatchedQty: 50,
        unit: "tonnes",
      },
    ],
    dispatchDate: "2026-08-31",
    expectedArrival: "2026-09-01",
    token: adminToken,
  });

  // 4. Foreign BOQ item under Project Beta
  const itemBetaId = await client.mutation(api.project_items.createProjectItem, {
    projectId: projBeta._id,
    itemName: "Beta Reinforcement Bars",
    unit: "tonnes",
    boqQty: 100,
    estimatedRate: 45000,
    token: adminToken,
  });

  // 5. Upload real proof photo to Convex Storage for DC Beta
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, { token: adminToken });
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: Buffer.from("fake-jpeg-proof-photo"),
  });
  const { storageId: realPhotoStorageId } = await uploadRes.json();

  console.log(`  ✔ In-Scope PO Alpha-1  (ID: ${poAlpha1?.id || "existing"}, Spend: ₹10,000)`);
  console.log(`  ✔ Foreign MR Alpha-2   (ID: ${mrAlpha2.id})`);
  console.log(`  ✔ Foreign MR Beta      (ID: ${mrBeta.id})`);
  console.log(`  ✔ Foreign CC Beta      (ID: ${ccBeta.id})`);
  console.log(`  ✔ Foreign PO Beta      (ID: ${poBeta.id}, Spend: ₹25,000)`);
  console.log(`  ✔ Foreign DC Beta      (ID: ${dcBeta.id})`);
  console.log(`  ✔ Foreign BOQ Item     (ID: ${itemBetaId})`);
  console.log(`  ✔ Foreign Storage Photo (ID: ${realPhotoStorageId})`);

  // ── 5. RUN LIVE IDOR SWEEP AS SUPERVISOR ──────────────────────────────────
  console.log("\n[5/5] Executing Live IDOR Sweep against Real Convex Endpoints...\n");

  async function testForbidden(name, type, desc, fn) {
    try {
      const res = await fn();
      results.push({ name, type, desc, passed: false, error: `Expected Forbidden error, but returned: ${JSON.stringify(res)}` });
      console.log(`  ❌ [FAIL] ${name}: ${desc} (Did not throw error!)`);
    } catch (err) {
      const msg = String(err?.message || err);
      const isForbidden = msg.includes("Forbidden") || msg.includes("Unauthorized");
      results.push({ name, type, desc, passed: isForbidden, errorCaptured: msg });
      if (isForbidden) {
        console.log(`  ✔ [PASS] ${name}: ${desc}`);
        console.log(`     ↳ Captured: "${msg.split("\n")[0]}"`);
      } else {
        console.log(`  ❌ [FAIL] ${name}: ${desc} (Threw unexpected error: ${msg})`);
      }
    }
  }

  // T1: getMR with foreign Site Alpha-2 MR (Site Precedence Check)
  await testForbidden(
    "getMR (Site Isolation)",
    "query",
    "Supervisor A1 blocked from Site Alpha-2 MR (same parent project, foreign site)",
    () => client.query(api.material_requests.getMR, { id: mrAlpha2.id, token: supervisorToken })
  );

  // T2: getMR with foreign Project Beta MR (Project Isolation Check)
  await testForbidden(
    "getMR (Project Isolation)",
    "query",
    "Supervisor A1 blocked from Project Beta MR",
    () => client.query(api.material_requests.getMR, { id: mrBeta.id, token: supervisorToken })
  );

  // T3: getCC with foreign Project Beta CC
  await testForbidden(
    "getCC",
    "query",
    "Supervisor A1 blocked from Project Beta Cost Comparison",
    () => client.query(api.cost_comparisons.getCC, { id: ccBeta.id, token: supervisorToken })
  );

  // T4: getPO with foreign Project Beta PO
  await testForbidden(
    "getPO",
    "query",
    "Supervisor A1 blocked from Project Beta Purchase Order",
    () => client.query(api.purchase_orders.getPO, { id: poBeta.id, token: supervisorToken })
  );

  // T5: getDC with foreign Site Beta-1 DC
  await testForbidden(
    "getDC",
    "query",
    "Supervisor A1 blocked from Site Beta-1 Delivery Challan",
    () => client.query(api.delivery_challans.getDC, { id: dcBeta.id, token: supervisorToken })
  );

  // T6: getDocumentLogs with foreign MR document ID
  await testForbidden(
    "getDocumentLogs",
    "query",
    "Supervisor A1 blocked from audit logs of foreign MR",
    () => client.query(api.logs.getDocumentLogs, { documentId: mrBeta.id, token: supervisorToken })
  );

  // T7: getProject with foreign Project Beta ID
  await testForbidden(
    "getProject",
    "query",
    "Supervisor A1 blocked from loading Project Beta details",
    () => client.query(api.projects.getProject, { id: projBeta._id, token: supervisorToken })
  );

  // T8: getFileUrl with foreign Storage Photo
  await testForbidden(
    "getFileUrl",
    "query",
    "Supervisor A1 blocked from resolving download URL for unlinked/foreign file",
    () => client.query(api.files.getFileUrl, { storageId: realPhotoStorageId, token: supervisorToken })
  );

  // T9: listProjectItems on foreign Project Beta (Must return empty list [])
  try {
    const items = await client.query(api.project_items.listProjectItems, {
      projectId: projBeta._id,
      token: supervisorToken,
    });
    const passed = Array.isArray(items) && items.length === 0;
    results.push({
      name: "listProjectItems",
      type: "query",
      desc: "Supervisor A1 querying Project Beta items receives empty list []",
      passed,
      details: { returnedCount: items.length },
    });
    if (passed) {
      console.log(`  ✔ [PASS] listProjectItems: Supervisor A1 querying Project Beta receives 0 items (Fail-closed)`);
    } else {
      console.log(`  ❌ [FAIL] listProjectItems: Leaked ${items.length} items from Project Beta!`);
    }
  } catch (err) {
    results.push({ name: "listProjectItems", type: "query", desc: "listProjectItems", passed: false, error: String(err) });
  }

  // T10: getVendorDetails non-trivial financial spend isolation
  try {
    const vendorDetails = await client.query(api.vendors.getVendorDetails, {
      id: sharedVendor._id,
      token: supervisorToken,
    });
    const spend = vendorDetails?.totalSpend || 0;
    const poList = vendorDetails?.pos || [];
    const hasBetaPO = poList.some((p) => p._id === poBeta.id || p.projectId === projBeta._id);
    const hasOnlyAlphaPOs = poList.every((p) => p.projectId === projAlpha._id);
    const passed = !hasBetaPO && hasOnlyAlphaPOs && typeof spend === "number";
    results.push({
      name: "getVendorDetails (Financial Scoping)",
      type: "query",
      desc: `Supervisor A1 sees only ₹${spend} from assigned project, strictly excluding PO Beta (₹25,000)`,
      passed,
      details: { totalSpend: spend, poCount: poList.length, hasBetaPO, hasOnlyAlphaPOs },
    });
    if (passed) {
      console.log(`  ✔ [PASS] getVendorDetails (Financial Scoping): totalSpend = ₹${spend} (strictly excluded foreign PO Beta ₹25,000)`);
    } else {
      console.log(`  ❌ [FAIL] getVendorDetails: Leaked foreign Project Beta POs into supervisor vendor details!`);
    }
  } catch (err) {
    results.push({ name: "getVendorDetails", type: "query", desc: "getVendorDetails", passed: false, error: String(err) });
  }

  // T11: createMR mutation against foreign Site Beta-1
  await testForbidden(
    "createMR (Mutation Guard)",
    "mutation",
    "Supervisor A1 blocked from creating MR on foreign Project Beta",
    () =>
      client.mutation(api.material_requests.createMR, {
        projectId: projBeta._id,
        siteId: siteBeta1._id,
        items: [{ itemName: "Illegal Materials", quantity: 10, unit: "bags" }],
        priority: "normal",
        token: supervisorToken,
      })
  );

  // T12: deleteMR mutation against foreign MR Alpha-2
  await testForbidden(
    "deleteMR (Mutation Guard)",
    "mutation",
    "Supervisor A1 blocked from deleting foreign MR on Site Alpha-2",
    () => client.mutation(api.material_requests.deleteMR, { id: mrAlpha2.id, token: supervisorToken })
  );

  // T13: confirmDeliveryAndGenerateGRN on foreign DC Beta
  await testForbidden(
    "confirmDeliveryAndGenerateGRN (Mutation Guard)",
    "mutation",
    "Supervisor A1 blocked from generating GRN on foreign DC Beta",
    () =>
      client.mutation(api.grn.confirmDeliveryAndGenerateGRN, {
        deliveryChallanId: dcBeta.id,
        receivedItems: [{ itemName: "Beta Structural Steel", receivedQty: 50, expectedQty: 50, unit: "tonnes" }],
        photos: [realPhotoStorageId],
        token: supervisorToken,
      })
  );

  // T13: cancelPO mutation against foreign PO Beta
  await testForbidden(
    "cancelPO (Mutation Guard)",
    "mutation",
    "Supervisor A1 blocked from cancelling foreign PO Beta",
    () =>
      client.mutation(api.purchase_order_closure.cancelPO, {
        id: poBeta.id,
        reason: "Unauthorized cancellation attempt",
        token: supervisorToken,
      })
  );

  // T14: createProjectItem mutation against foreign Project Beta
  await testForbidden(
    "createProjectItem (Mutation Guard)",
    "mutation",
    "Supervisor A1 blocked from inserting BOQ item into Project Beta",
    () =>
      client.mutation(api.project_items.createProjectItem, {
        projectId: projBeta._id,
        itemName: "Illegal BOQ Entry",
        unit: "bags",
        token: supervisorToken,
      })
  );

  console.log("\n================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`   SWEEP SUMMARY: ${passed}/${total} assertions PASSED`);
  if (passed === total) {
    console.log("   🔴 GATE 2 BACKEND SWEEP: PASSED ✔ (Real foreign IDs strictly fail-closed)");
  } else {
    console.log("   🔴 GATE 2 BACKEND SWEEP: FAILED ❌");
  }
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running live IDOR sweep:", err);
  process.exit(1);
});
