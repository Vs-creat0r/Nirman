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
  Truck,
  User,
  Phone,
  Calendar,
  Building2,
  Package,
  AlertCircle,
  Clock,
  Send,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

interface DispatchDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId?: Id<"purchase_order">;
  onSuccess?: () => void;
}

interface DispatchedItemState {
  itemName: string;
  orderedQty: number;
  alreadyDispatchedQty: number;
  remainingDispatchQty: number;
  dispatchedQty: number;
  unit: string;
  hsnSacCode?: string;
}

export function DispatchDeliveryModal({
  isOpen,
  onClose,
  purchaseOrderId: initialPOId,
  onSuccess,
}: DispatchDeliveryModalProps) {
  const router = useRouter();
  const { token } = useSession();

  const createDCMutation = useMutation(api.delivery_challans.createDC);
  const approvedPOs = useQuery(
    api.delivery_challans.listApprovedPOsForDispatch,
    token ? { token } : "skip"
  );

  const [selectedPOId, setSelectedPOId] = React.useState<string>(initialPOId || "");
  const [vehicleNo, setVehicleNo] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [driverPhone, setDriverPhone] = React.useState("");

  const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], []);
  const [dispatchDate, setDispatchDate] = React.useState(todayStr);
  const [expectedArrival, setExpectedArrival] = React.useState(todayStr);
  const [notes, setNotes] = React.useState("");
  const [dispatchedItems, setDispatchedItems] = React.useState<DispatchedItemState[]>([]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync initial PO if provided
  React.useEffect(() => {
    if (initialPOId) {
      setSelectedPOId(initialPOId);
    }
  }, [initialPOId]);

  // Selected PO object
  const currentPO = React.useMemo(() => {
    return (approvedPOs as any[])?.find((p: any) => p._id === selectedPOId);
  }, [approvedPOs, selectedPOId]);

  // When PO changes, snapshot its remaining dispatchable line items
  React.useEffect(() => {
    if (currentPO && currentPO.lineItemsWithDispatch) {
      setDispatchedItems(
        currentPO.lineItemsWithDispatch.map((item: any) => {
          const remaining = item.remainingDispatchQty ?? item.quantity;
          return {
            itemName: item.itemName,
            orderedQty: item.orderedQty ?? item.quantity,
            alreadyDispatchedQty: item.alreadyDispatchedQty ?? 0,
            remainingDispatchQty: remaining,
            dispatchedQty: remaining, // Pre-fill with remaining dispatchable balance
            unit: item.unit,
            hsnSacCode: item.hsnSacCode,
          };
        })
      );
    }
  }, [currentPO]);

  if (!isOpen) return null;

  const handleItemQtyChange = (index: number, val: number) => {
    setDispatchedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], dispatchedQty: val };
      return copy;
    });
  };

  const handleFillRemaining = (index: number) => {
    setDispatchedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], dispatchedQty: copy[index].remainingDispatchQty };
      return copy;
    });
  };

  const handleFillAllRemaining = () => {
    setDispatchedItems((prev) =>
      prev.map((item) => ({ ...item, dispatchedQty: item.remainingDispatchQty }))
    );
  };

  const isPartialDispatch = dispatchedItems.some(
    (item) => item.dispatchedQty < item.remainingDispatchQty || item.alreadyDispatchedQty > 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOId) {
      setError("Please select an approved Purchase Order.");
      return;
    }

    const cleanVehicle = vehicleNo.trim().toUpperCase();
    if (!cleanVehicle || cleanVehicle.length < 4) {
      setError("Please enter a valid Vehicle Registration Number (e.g. MH-12-AB-1234).");
      return;
    }

    const cleanDriver = driverName.trim();
    if (!cleanDriver || cleanDriver.length < 2) {
      setError("Please enter the driver's full name.");
      return;
    }

    const activeItems = dispatchedItems.filter(
      (item) => !isNaN(item.dispatchedQty) && item.dispatchedQty > 0
    );

    if (activeItems.length === 0) {
      setError(
        "Please enter a dispatched quantity greater than 0 for at least one item on this vehicle."
      );
      return;
    }

    for (const item of activeItems) {
      if (item.dispatchedQty > item.remainingDispatchQty) {
        setError(
          `Dispatched quantity (${item.dispatchedQty}) for "${item.itemName}" cannot exceed remaining balance (${item.remainingDispatchQty} ${item.unit}). Over-delivery is not allowed.`
        );
        return;
      }
    }

    setError(null);
    setIsLoading(true);

    try {
      await createDCMutation({
        purchaseOrderId: selectedPOId as Id<"purchase_order">,
        vehicleNo: cleanVehicle,
        driverName: cleanDriver,
        driverPhone: driverPhone.trim() || undefined,
        dispatchedItems: activeItems.map((item) => ({
          itemName: item.itemName,
          orderedQty: item.orderedQty,
          dispatchedQty: item.dispatchedQty,
          unit: item.unit,
          hsnSacCode: item.hsnSacCode,
        })),
        dispatchDate,
        expectedArrival,
        notes: notes.trim() || undefined,
        token: token || undefined,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/deliveries");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create Delivery Challan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Dispatch Delivery Challan
                </h2>
                {isPartialDispatch && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Partial Batch Dispatch
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Issue a physical transit challan with vehicle details and custom dispatched quantities.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select PO */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Select Approved Purchase Order <span className="text-destructive">*</span>
            </Label>
            {approvedPOs === undefined ? (
              <div className="h-9 rounded-md bg-muted animate-pulse" />
            ) : approvedPOs.length === 0 ? (
              <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                No approved Purchase Orders with remaining dispatchable balance available.
              </div>
            ) : (
              <select
                value={selectedPOId}
                onChange={(e) => setSelectedPOId(e.target.value)}
                disabled={!!initialPOId}
                className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- Choose Purchase Order --</option>
                {approvedPOs.map((po: any) => (
                  <option key={po._id} value={po._id}>
                    {po.refNo} — {po.vendorName} ({po.projectName} / {po.siteName})
                    {po.isPartiallyDispatched
                      ? ` · Partial (Remaining: ${po.totalRemainingDispatchQty} units)`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected PO Meta */}
          {currentPO && (
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {currentPO.vendorName}
                </span>
                <span className="text-muted-foreground">
                  Destination Site: <strong className="text-foreground">{currentPO.siteName}</strong>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                <span>PO Total: ₹{currentPO.totalAmount?.toLocaleString() || "—"}</span>
                <span>
                  Dispatched so far:{" "}
                  <strong className="text-foreground">
                    {currentPO.totalDispatchedQty || 0} / {currentPO.totalOrderedQty || 0} units
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Vehicle & Driver Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Vehicle Registration No. <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Truck className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. MH-12-AB-1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  className="pl-8 text-xs font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Driver Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="pl-8 text-xs"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Driver Phone (Optional)
              </Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="10-digit mobile"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="pl-8 text-xs font-mono"
                  type="tel"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Dispatch Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="pl-8 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Expected Arrival Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                  className="pl-8 text-xs"
                  required
                />
              </div>
            </div>
          </div>

          {/* Dispatched Line Items Table with Remaining Balances */}
          {dispatchedItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  Line Items & Dispatched Quantities
                </Label>
                <button
                  type="button"
                  onClick={handleFillAllRemaining}
                  className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Dispatch All Remaining
                </button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Already Sent</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                      <th className="px-3 py-2 text-right w-36">This Trip Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dispatchedItems.map((item, idx) => {
                      const isOver = item.dispatchedQty > item.remainingDispatchQty;
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <span className="font-medium text-foreground block">
                              {item.itemName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Unit: {item.unit}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {item.orderedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {item.alreadyDispatchedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                            <button
                              type="button"
                              onClick={() => handleFillRemaining(idx)}
                              title="Click to fill remaining balance"
                              className="hover:text-primary hover:underline"
                            >
                              {item.remainingDispatchQty}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0.01}
                                max={item.remainingDispatchQty}
                                step="any"
                                value={item.dispatchedQty || ""}
                                onChange={(e) =>
                                  handleItemQtyChange(idx, parseFloat(e.target.value) || 0)
                                }
                                className={`h-7 w-24 text-right text-xs font-mono font-bold ${
                                  isOver
                                    ? "border-destructive focus-visible:ring-destructive text-destructive"
                                    : ""
                                }`}
                              />
                            </div>
                            {isOver && (
                              <span className="text-[9px] text-destructive block mt-0.5">
                                Max: {item.remainingDispatchQty}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Transit Notes / Gate Instructions (Optional)
            </Label>
            <textarea
              rows={2}
              placeholder="e.g. Unload at Tower B staging area. Contact supervisor upon gate entry."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !selectedPOId}
              className="text-xs gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {isLoading ? "Dispatching..." : "Dispatch Delivery Challan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
