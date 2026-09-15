"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { DocumentForm } from "@/components/document/document-form";
import { ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
import purchaseOrderContract from "@/contracts/purchase_order.json";
import type { DocumentContract } from "@/lib/form-engine-types";

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useSession();
  const id = params?.id as Id<"purchase_order">;

  const user = useQuery(api.users.getMyUser, token ? { token } : "skip");
  const po = useQuery(
    api.purchase_orders.getPO,
    id && token ? { id, token } : "skip"
  );
  const projects = useQuery(
    api.projects.listProjects,
    token ? { token } : "skip"
  );
  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const vendors = useQuery(api.vendors.listVendors, token ? { token } : "skip");

  const updatePOMutation = useMutation(api.purchase_orders.updatePO);
  const submitPOMutation = useMutation(api.purchase_orders.submitPO);
  const deletePOMutation = useMutation(api.purchase_order_closure.deletePO);

  const availableActionsData = useQuery(
    api.lifecycle.availableActions,
    id && token ? { table: "purchase_order", documentId: id, token } : "skip"
  );

  const canSubmit = availableActionsData?.actions.find((a) => a.name === "submit");
  const canResubmit = availableActionsData?.actions.find((a) => a.name === "resubmit");
  const isResubmission = Boolean(canResubmit);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDiscarding, setIsDiscarding] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const saveOnlyRef = React.useRef(false);

  // Server-side RBAC guard: only procurement_officer, project_manager, admin may access edit
  const isAuthorized = user && ["procurement_officer", "project_manager", "admin"].includes(user.role);

  const handleDiscardDraft = async () => {
    setError(null);
    setIsDiscarding(true);
    try {
      await deletePOMutation({ id, token: token || undefined });
      router.push("/dashboard/procurement/purchase-orders");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to discard draft purchase order.");
      setIsDiscarding(false);
      setShowDiscardConfirm(false);
    }
  };

  if (!isAuthorized && user) {
    return (
      <div className="p-12 text-center text-xs text-destructive space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-bold">Access Denied</p>
        <p className="text-muted-foreground">Only Procurement Officers and Project Managers may edit purchase orders.</p>
        <Link href="/dashboard/procurement/purchase-orders">
          <button className="text-primary hover:underline mt-2">Back to Purchase Orders</button>
        </Link>
      </div>
    );
  }

  if (po === undefined || availableActionsData === undefined) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Purchase Order…</span>
      </div>
    );
  }

  if (po === null) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground">
        Purchase order not found.
      </div>
    );
  }

  if (po.status !== "draft" && po.status !== "queried") {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
        <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
        <p className="font-bold text-foreground">Purchase Order Locked</p>
        <p>Cannot edit Purchase Order in &quot;{po.status}&quot; status.</p>
        <Link href={`/dashboard/procurement/purchase-orders/${id}`}>
          <button className="text-primary hover:underline mt-2">View Purchase Order</button>
        </Link>
      </div>
    );
  }

  const optionsMap = {
    projects: (projects || []).map((p) => ({
      value: p._id,
      label: `${p.name} (${p.code})`,
    })),
    sites: (sites || []).map((s) => ({
      value: s._id,
      label: `${s.name} (${s.code})`,
    })),
    vendors: (vendors || []).map((v) => ({
      value: v._id,
      label: v.name,
    })),
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setError(null);
    setIsSubmitting(true);
    const isSaveOnly = saveOnlyRef.current;
    saveOnlyRef.current = false;

    try {
      const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
      if (lineItems.length === 0) {
        throw new Error("Please add at least one line item.");
      }

      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        if (!it.itemName || !it.itemName.trim()) {
          throw new Error(`Item #${i + 1} must have a valid item name.`);
        }
        const qty = Number(it.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Quantity for "${it.itemName}" must be greater than 0.`);
        }
        const rate = Number(it.rate);
        if (isNaN(rate) || rate < 0) {
          throw new Error(`Rate for "${it.itemName}" must be a non-negative number.`);
        }
      }

      const payload = {
        id,
        vendorId: data.vendorId ? (data.vendorId as Id<"vendors">) : undefined,
        siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
        lineItems: lineItems.map((it: Record<string, unknown>) => ({
          itemName: String(it.itemName || "").trim(),
          description: it.description ? String(it.description).trim() : undefined,
          hsnSacCode: it.hsnSacCode ? String(it.hsnSacCode).trim() : undefined,
          quantity: Number(it.quantity),
          unit: String(it.unit || "NOS"),
          rate: Number(it.rate || 0),
          amount: Math.round(Number(it.quantity || 0) * Number(it.rate || 0) * 100) / 100,
          projectItemId: it.projectItemId ? (it.projectItemId as Id<"project_items">) : undefined,
          isUnquotedAddition: Boolean(it.isUnquotedAddition),
          additionReason: it.additionReason ? String(it.additionReason).trim() : undefined,
        })),
        expectedDelivery: data.expectedDelivery ? String(data.expectedDelivery) : undefined,
        validUntil: data.validUntil ? String(data.validUntil) : undefined,
        paymentTerms: data.paymentTerms as
          | "advance"
          | "on_delivery"
          | "7_days"
          | "15_days"
          | "30_days"
          | "45_days"
          | undefined,
        placeOfSupplyStateCode: data.placeOfSupplyStateCode ? String(data.placeOfSupplyStateCode) : undefined,
        siteContactPerson: data.siteContactPerson ? String(data.siteContactPerson) : undefined,
        siteContactPhone: data.siteContactPhone ? String(data.siteContactPhone) : undefined,
        unloadingScope: data.unloadingScope as "buyer_scope" | "vendor_scope" | undefined,
        freightTerms: data.freightTerms as
          | "inclusive_in_rate"
          | "extra_at_actuals"
          | "fixed_freight"
          | "to_pay_by_site"
          | undefined,
        freight: data.freight !== undefined && data.freight !== "" ? Number(data.freight) : undefined,
        taxRate: data.taxRate !== undefined && data.taxRate !== "" ? Number(data.taxRate) : undefined,
        procurementNotes: data.procurementNotes ? String(data.procurementNotes).trim() : undefined,
        termsAndConditions: data.termsAndConditions ? String(data.termsAndConditions).trim() : undefined,
        token: token || undefined,
      };

      if (isSaveOnly) {
        await updatePOMutation(payload);
        router.push(`/dashboard/procurement/purchase-orders/${id}`);
        return;
      }

      await updatePOMutation(payload);
      await submitPOMutation({ id, token: token || undefined });

      router.push(`/dashboard/procurement/purchase-orders/${id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save purchase order.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href={`/dashboard/procurement/purchase-orders/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cancel & Back
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {isResubmission
              ? `Edit & Resubmit ${po.refNo}`
              : `Edit Purchase Order — ${po.refNo}`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isResubmission
              ? "Address reviewer feedback and resubmit for Project Manager approval."
              : "Update line items, freight terms, delivery site, and commercial details."}
          </p>
        </div>
      </div>

      {/* Query feedback from reviewer */}
      {po.reviewNote && (
        <div className="p-4 rounded-lg bg-[--warning]/10 border border-[--warning]/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[--warning] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-[--warning]">
              Reviewer Feedback / Query Note
            </h3>
            <p className="text-xs text-foreground mt-0.5">
              {po.reviewNote}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Editable form driven by purchaseOrderContract */}
      <DocumentForm
        contract={purchaseOrderContract as unknown as DocumentContract}
        optionsMap={optionsMap}
        onSubmit={handleSubmit}
        submitLabel={isResubmission ? "Resubmit for Approval" : "Submit for Approval"}
        isSubmitting={isSubmitting || isDiscarding}
        footerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting || isDiscarding}
              onClick={(e) => {
                saveOnlyRef.current = true;
                const form = (e.currentTarget as HTMLElement).closest("form");
                if (form) {
                  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                  if (submitBtn) submitBtn.click();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-border bg-surface hover:bg-muted text-foreground transition-colors cursor-pointer shadow-xs"
            >
              {isResubmission ? "Save Changes" : "Save Draft"}
            </button>
            {canSubmit && (
              <button
                type="button"
                disabled={isSubmitting || isDiscarding}
                onClick={() => setShowDiscardConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-2 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard draft
              </button>
            )}
          </div>
        }
        defaultValues={{
          refNo: po.refNo,
          status: po.status,
          vendorId: po.vendorId,
          projectId: po.projectId,
          siteId: po.siteId || "",
          lineItems: po.lineItems,
          expectedDelivery: po.expectedDelivery || "",
          validUntil: po.validUntil || "",
          paymentTerms: po.paymentTerms || "30_days",
          placeOfSupplyStateCode: po.placeOfSupplyStateCode || "",
          siteContactPerson: po.siteContactPerson || "",
          siteContactPhone: po.siteContactPhone || "",
          unloadingScope: po.unloadingScope || "buyer_scope",
          freightTerms: po.freightTerms || "inclusive_in_rate",
          freight: po.freight ?? 0,
          taxRate: po.taxRate ?? 18,
          procurementNotes: po.procurementNotes || "",
          termsAndConditions: po.termsAndConditions || "",
        }}
      />

      {/* Discard Confirmation Dialog */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Discard {po.refNo}?
              </h3>
              <p className="text-xs text-muted-foreground">
                This draft and its {po.lineItems?.length || 0} line items will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isDiscarding}
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-surface hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                Keep editing
              </button>
              <button
                type="button"
                disabled={isDiscarding}
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors cursor-pointer"
              >
                {isDiscarding ? "Discarding…" : `Discard ${po.refNo}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

