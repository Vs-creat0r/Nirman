"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Layers,
  Sparkles,
  Lock,
  Truck,
  Phone,
  User,
  MapPin,
  Send,
} from "lucide-react";

const STANDARD_UNITS = [
  "bags",
  "MT",
  "kg",
  "nos",
  "cum",
  "brass",
  "sqm",
  "ltr",
  "rmt",
] as const;

const ITEM_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "steel", label: "Steel" },
  { value: "cement", label: "Cement" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
] as const;

const INDIAN_STATES = [
  { code: "27", name: "27 - Maharashtra" },
  { code: "24", name: "24 - Gujarat" },
  { code: "29", name: "29 - Karnataka" },
  { code: "07", name: "07 - Delhi" },
  { code: "33", name: "33 - Tamil Nadu" },
  { code: "36", name: "36 - Telangana" },
  { code: "19", name: "19 - West Bengal" },
  { code: "09", name: "09 - Uttar Pradesh" },
  { code: "08", name: "08 - Rajasthan" },
  { code: "23", name: "23 - Madhya Pradesh" },
  { code: "06", name: "06 - Haryana" },
  { code: "03", name: "03 - Punjab" },
  { code: "10", name: "10 - Bihar" },
  { code: "32", name: "32 - Kerala" },
  { code: "21", name: "21 - Odisha" },
  { code: "37", name: "37 - Andhra Pradesh" },
  { code: "22", name: "22 - Chhattisgarh" },
  { code: "20", name: "20 - Jharkhand" },
  { code: "30", name: "30 - Goa" },
  { code: "05", name: "05 - Uttarakhand" },
  { code: "02", name: "02 - Himachal Pradesh" },
  { code: "01", name: "01 - Jammu & Kashmir" },
  { code: "18", name: "18 - Assam" },
] as const;

type PaymentTermType = "advance" | "on_delivery" | "7_days" | "15_days" | "30_days" | "45_days";

export interface POLineItemData {
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount?: number;
  hsnSacCode?: string;
  projectItemId?: Id<"project_items">;
  isUnquotedAddition?: boolean;
  additionReason?: string;
}

export interface EditablePOLineItem extends POLineItemData {
  isCustomNewItem?: boolean;
  category?: string;
}

export interface PurchaseOrderModalData {
  _id: Id<"purchase_order">;
  refNo: string;
  status: string;
  projectId: Id<"projects">;
  vendorName?: string;
  lineItems: POLineItemData[];
  taxRate?: number;
  freight?: number;
  paymentTerms?: PaymentTermType;
  placeOfSupplyStateCode?: string;
  siteContactPerson?: string;
  siteContactPhone?: string;
  unloadingScope?: "buyer_scope" | "vendor_scope";
  freightTerms?: "inclusive_in_rate" | "extra_at_actuals" | "fixed_freight" | "to_pay_by_site";
  procurementNotes?: string;
  expectedDelivery?: string;
  validUntil?: string;
  termsAndConditions?: string;
  reviewNote?: string;
}

interface EditPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderModalData;
}

export function EditPOModal({ isOpen, onClose, po }: EditPOModalProps) {
  const router = useRouter();
  const { token } = useSession();
  const resubmitPOMutation = useMutation(api.purchase_order_approvals.resubmitPO);
  const deletePOMutation = useMutation(api.purchase_order_closure.deletePO);

  const projectItems = useQuery(
    api.project_items.listProjectItems,
    po?.projectId && token ? { projectId: po.projectId, token } : "skip"
  );

  const [lineItems, setLineItems] = React.useState<EditablePOLineItem[]>(() =>
    po?.lineItems ? po.lineItems.map((item) => ({ ...item })) : []
  );
  const [taxRate, setTaxRate] = React.useState<number>(po?.taxRate ?? 18);
  const [freight, setFreight] = React.useState<number>(po?.freight ?? 0);
  const [paymentTerms, setPaymentTerms] = React.useState<PaymentTermType>(
    po?.paymentTerms ?? "30_days"
  );
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState<string>(
    po?.placeOfSupplyStateCode || "27"
  );
  const [siteContactPerson, setSiteContactPerson] = React.useState<string>(
    po?.siteContactPerson || ""
  );
  const [siteContactPhone, setSiteContactPhone] = React.useState<string>(
    po?.siteContactPhone || ""
  );
  const [unloadingScope, setUnloadingScope] = React.useState<"buyer_scope" | "vendor_scope">(
    po?.unloadingScope || "buyer_scope"
  );
  const [freightTerms, setFreightTerms] = React.useState<
    "inclusive_in_rate" | "extra_at_actuals" | "fixed_freight" | "to_pay_by_site"
  >(po?.freightTerms || (Number(po?.freight) > 0 ? "fixed_freight" : "inclusive_in_rate"));
  const [procurementNotes, setProcurementNotes] = React.useState<string>(
    po?.procurementNotes || ""
  );
  const [expectedDelivery, setExpectedDelivery] = React.useState<string>(po?.expectedDelivery || "");
  const [validUntil, setValidUntil] = React.useState<string>(po?.validUntil || "");
  const [termsAndConditions, setTermsAndConditions] = React.useState<string>(po?.termsAndConditions || "");

  const [isSaving, setIsSaving] = React.useState(false);
  const [isDiscarding, setIsDiscarding] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isDraft = po?.status === "draft";
  const isQueried = po?.status === "queried";
  const hasValidQueryNote =
    isQueried &&
    po?.reviewNote &&
    po.reviewNote.trim() !== "" &&
    po.reviewNote.trim().toUpperCase() !== "NA";

  const handleDiscardDraft = async () => {
    setError(null);
    setIsDiscarding(true);
    try {
      await deletePOMutation({ id: po._id, token: token || undefined });
      onClose();
      router.push("/dashboard/procurement/purchase-orders");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to discard draft Purchase Order.");
      setIsDiscarding(false);
      setShowDiscardConfirm(false);
    }
  };

  // Real-time calculations
  const subtotal = React.useMemo(() => {
    return (
      Math.round(
        lineItems.reduce(
          (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
          0
        ) * 100
      ) / 100
    );
  }, [lineItems]);

  const taxAmount = React.useMemo(() => {
    return Math.round(subtotal * (taxRate / 100) * 100) / 100;
  }, [subtotal, taxRate]);

  const totalAmount = React.useMemo(() => {
    return Math.round((subtotal + taxAmount + (Number(freight) || 0)) * 100) / 100;
  }, [subtotal, taxAmount, freight]);

  const handleItemChange = (
    index: number,
    field: keyof EditablePOLineItem,
    value: string | number | boolean | undefined
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleBOQItemSelect = (index: number, selectedValue: string) => {
    const updated = [...lineItems];
    if (selectedValue === "custom_new") {
      updated[index] = {
        ...updated[index],
        itemName: "",
        unit: "",
        rate: 0,
        projectItemId: undefined,
        isCustomNewItem: true,
        category: "materials",
        isUnquotedAddition: true,
        additionReason: "Added during PO review",
      };
    } else {
      const selected = projectItems?.find((p) => p._id === selectedValue);
      if (selected) {
        updated[index] = {
          ...updated[index],
          itemName: selected.name,
          unit: selected.unit,
          rate: updated[index].rate > 0 ? updated[index].rate : 0,
          projectItemId: selected._id as Id<"project_items">,
          isCustomNewItem: false,
          category: selected.category,
          isUnquotedAddition: true,
          additionReason: "Selected from Project BOQ catalog",
        };
      }
    }
    setLineItems(updated);
  };

  const handleAddItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        itemName: "",
        quantity: 1,
        unit: "",
        rate: 0,
        isCustomNewItem: true,
        category: "materials",
        isUnquotedAddition: true,
        additionReason: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveOrResubmit = async (submitImmediately: boolean) => {
    if (lineItems.length === 0) {
      setError("Purchase Order must have at least one line item.");
      return;
    }

    if (isQueried) {
      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        if (!it.itemName || !it.itemName.trim()) {
          setError(`Line Item #${i + 1} must have a valid item name.`);
          return;
        }
        if (!it.unit || !it.unit.trim()) {
          setError(`Line Item #${i + 1} ("${it.itemName || "Item"}") must have a unit of measurement selected.`);
          return;
        }
        if (Number(it.quantity) <= 0 || isNaN(Number(it.quantity))) {
          setError(`Quantity for "${it.itemName}" must be greater than zero.`);
          return;
        }
        if (Number(it.rate) < 0 || isNaN(Number(it.rate))) {
          setError(`Rate for "${it.itemName}" must be non-negative.`);
          return;
        }
        if (it.isUnquotedAddition && (!it.additionReason || !it.additionReason.trim())) {
          setError(`Please specify an Addition Reason note for "${it.itemName}".`);
          return;
        }
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Preserve existing projectItemId if present; otherwise mark cleanly as off-BOQ addition
      const resolvedLineItems = lineItems.map((it) => {
        const isAddition = Boolean(it.isUnquotedAddition || !it.projectItemId);
        return {
          itemName: it.itemName.trim(),
          quantity: Number(it.quantity) || 0,
          unit: it.unit.trim(),
          rate: Number(it.rate) || 0,
          hsnSacCode: it.hsnSacCode?.trim() || undefined,
          projectItemId: it.projectItemId || undefined,
          isUnquotedAddition: isAddition ? true : undefined,
          additionReason: isAddition
            ? (it.additionReason?.trim() || "Item added or revised during PO review")
            : undefined,
        };
      });

      await resubmitPOMutation({
        id: po._id,
        lineItems: resolvedLineItems,
        taxRate: typeof taxRate === "number" && !isNaN(taxRate) ? Math.max(0, Math.min(100, taxRate)) : 18,
        freight: Number(freight) > 0 ? Number(freight) : undefined,
        placeOfSupplyStateCode,
        siteContactPerson: siteContactPerson.trim() || undefined,
        siteContactPhone: siteContactPhone.trim() || undefined,
        unloadingScope,
        freightTerms,
        procurementNotes: procurementNotes.trim() || undefined,
        paymentTerms,
        expectedDelivery: expectedDelivery || undefined,
        validUntil: validUntil || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
        submitImmediately,
        token: token || undefined,
      });

      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update Purchase Order.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {isDraft ? "Edit Draft Purchase Order" : "Edit & Resubmit Queried PO"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Reference: <span className="font-mono font-semibold text-foreground">{po?.refNo || "PO"}</span> &bull; Vendor: <span className="font-semibold text-foreground">{po?.vendorName || "Vendor"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Manager Review Query Banner (Only shown when queried and note exists) */}
        {hasValidQueryNote && (
          <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Project Manager Review Query:</span>
              <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">&ldquo;{po.reviewNote}&rdquo;</p>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* Line Items Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Order Line Items ({lineItems.length})
              </Label>
              {/* Only show Add Item button when in Queried status */}
              {isQueried && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="text-[11px] h-7 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  + Add Line Item
                </Button>
              )}
            </div>

            {/* DRAFT STATE: Read-Only Locked Table */}
            {isDraft && (
              <div className="space-y-2">
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground border-b border-border text-[11px]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Item Name</th>
                        <th className="px-3 py-2 font-semibold text-right">Qty</th>
                        <th className="px-3 py-2 font-semibold">Unit</th>
                        <th className="px-3 py-2 font-semibold text-right">Rate (₹)</th>
                        <th className="px-3 py-2 font-semibold text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{item.itemName}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                          <td className="px-3 py-2 text-right font-mono">₹{item.rate.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                            ₹{(item.quantity * item.rate).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded border border-border/50">
                  <Lock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span>
                    Line items and pricing are locked to the approved Cost Comparison. You can adjust validity date, delivery schedule, payment terms, and terms & conditions below.
                  </span>
                </div>
              </div>
            )}

            {/* QUERIED STATE: Editable Line Items with Project Item Auto-Sync */}
            {isQueried && (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3.5 rounded-lg border text-xs space-y-3 ${
                      item.isUnquotedAddition
                        ? "border-warning/40 bg-warning/5"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {/* Item Selector / Name */}
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                          <span>Item Description <span className="text-destructive">*</span></span>
                          {item.isUnquotedAddition && (
                            <span className="text-[10px] font-bold text-warning flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> Scope Addition
                            </span>
                          )}
                        </Label>

                        {item.isCustomNewItem ? (
                          <div className="space-y-1.5">
                            <Input
                              type="text"
                              required
                              placeholder="Enter item name..."
                              value={item.itemName}
                              onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                              className="text-xs h-8 font-medium"
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground font-semibold">Category:</span>
                              <select
                                value={item.category || "materials"}
                                onChange={(e) => handleItemChange(index, "category", e.target.value)}
                                className="flex h-7 rounded border border-border bg-input px-2 text-[11px]"
                              >
                                {ITEM_CATEGORIES.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                              <span className="text-[10px] text-primary flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> Auto-syncs to BOQ
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* BOQ Selection Dropdown */}
                            {projectItems && projectItems.length > 0 ? (
                              <select
                                value={item.projectItemId || "existing"}
                                onChange={(e) => handleBOQItemSelect(index, e.target.value)}
                                className="flex h-8 w-full rounded-md border border-border bg-input px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <option value="existing">{item.itemName} (Current Item)</option>
                                <optgroup label="Select from Project BOQ">
                                  {projectItems.map((pi) => (
                                    <option key={pi._id} value={pi._id}>
                                      {pi.name} ({pi.unit})
                                    </option>
                                  ))}
                                </optgroup>
                                <option value="custom_new">+ Add Custom / New Item to Project</option>
                              </select>
                            ) : (
                              <Input
                                type="text"
                                required
                                value={item.itemName}
                                onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                                className="text-xs h-8"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Qty <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                          className="text-xs h-8 font-mono"
                        />
                      </div>

                      {/* Unit */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Unit <span className="text-destructive">*</span>
                        </Label>
                        <select
                          required
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          className="flex h-8 w-full rounded-md border border-border bg-input px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">-- Select Unit --</option>
                          {STANDARD_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Rate */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Rate (₹) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", Number(e.target.value))}
                          className="text-xs h-8 font-mono"
                        />
                      </div>

                      {/* Delete Action */}
                      <div className="sm:col-span-1 flex justify-end pt-5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={lineItems.length <= 1}
                          onClick={() => handleRemoveItem(index)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Justification for Unquoted Addition */}
                    {item.isUnquotedAddition && (
                      <div className="pt-2 border-t border-warning/20 space-y-1">
                        <Label className="text-[10px] font-bold text-warning uppercase tracking-wider flex items-center gap-1">
                          Addition Justification <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="text"
                          required
                          placeholder="State reason why this item is added/adjusted at PO stage..."
                          value={item.additionReason || ""}
                          onChange={(e) => handleItemChange(index, "additionReason", e.target.value)}
                          className="text-xs h-7 bg-surface text-foreground"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logistics, Delivery & Site Receiving Section */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
              <Truck className="h-3.5 w-3.5 text-primary" /> Delivery & Site Receiving Logistics
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" /> Valid Until
                </Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" /> Expected Delivery
                </Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" /> Site Contact Person
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Vikram Singh (Site In-Charge)"
                  value={siteContactPerson}
                  onChange={(e) => setSiteContactPerson(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" /> Site Contact Phone
                </Label>
                <Input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={siteContactPhone}
                  onChange={(e) => setSiteContactPhone(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Unloading Scope</Label>
                <select
                  value={unloadingScope}
                  onChange={(e) => setUnloadingScope(e.target.value as "buyer_scope" | "vendor_scope")}
                  className="flex h-8 w-full rounded-md border border-border bg-input px-2 text-xs"
                >
                  <option value="buyer_scope">Buyer Scope (Site Team unloads)</option>
                  <option value="vendor_scope">Vendor Scope (Vendor unloads)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Freight Terms</Label>
                <select
                  value={freightTerms}
                  onChange={(e) =>
                    setFreightTerms(
                      e.target.value as
                        | "inclusive_in_rate"
                        | "extra_at_actuals"
                        | "fixed_freight"
                        | "to_pay_by_site"
                    )
                  }
                  className="flex h-8 w-full rounded-md border border-border bg-input px-2 text-xs"
                >
                  <option value="inclusive_in_rate">Included in Rate (FOR Site)</option>
                  <option value="fixed_freight">Fixed Freight (Added to PO Total)</option>
                  <option value="extra_at_actuals">Extra at Actuals (Billed on LR)</option>
                  <option value="to_pay_by_site">To-Pay (Paid directly at site)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Statutory & Commercial Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
            {/* Place of Supply */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Place of Supply (GST State)
              </Label>
              <select
                value={placeOfSupplyStateCode}
                onChange={(e) => setPlaceOfSupplyStateCode(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Terms */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Terms</Label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as PaymentTermType)}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="advance">100% Advance</option>
                <option value="on_delivery">Payment on Delivery</option>
                <option value="7_days">Net 7 Days</option>
                <option value="15_days">Net 15 Days</option>
                <option value="30_days">Net 30 Days (Standard)</option>
                <option value="45_days">Net 45 Days</option>
              </select>
            </div>
          </div>

          {/* Financial Summary Breakdown */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Items Subtotal:</span>
              <span className="font-mono font-semibold text-foreground">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">GST Tax Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Freight Charges (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={freight}
                  onChange={(e) => setFreight(Number(e.target.value))}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-bold text-foreground">
              <span>Grand Total (Inclusive of GST & Freight):</span>
              <span className="font-mono text-primary">₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Terms & Conditions Textarea */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Terms & Conditions</Label>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed text-[11px]"
            />
          </div>

          {/* Procurement Officer Remarks */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Procurement Officer Remarks for Manager</Label>
            <Input
              type="text"
              placeholder="e.g. Scope confirmed with site engineer; delivery aligned with casting schedule..."
              value={procurementNotes}
              onChange={(e) => setProcurementNotes(e.target.value)}
              className="text-xs h-8"
            />
          </div>

          {/* Modal Actions Footer */}
          <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              {isDraft && (
                <>
                  {showDiscardConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive font-semibold">Discard this draft?</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isDiscarding}
                        onClick={handleDiscardDraft}
                        className="text-xs h-8"
                      >
                        {isDiscarding ? "Discarding…" : "Yes, Discard"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDiscardConfirm(false)}
                        className="text-xs h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDiscardConfirm(true)}
                      className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard Draft
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSaving}
                className="text-xs"
              >
                Cancel
              </Button>

              {isDraft ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => handleSaveOrResubmit(false)}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {isSaving ? "Saving…" : "Save PO Draft"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => handleSaveOrResubmit(true)}
                    className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isSaving ? "Submitting…" : "Submit for Manager Approval"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleSaveOrResubmit(true)}
                  className="text-xs font-semibold gap-1.5 bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isSaving ? "Resubmitting…" : "Resubmit for Manager Approval"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
