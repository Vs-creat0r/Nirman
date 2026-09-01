"use client";

import * as React from "react";
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
  Scale,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
} from "lucide-react";

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSiteId?: Id<"sites">;
  defaultItemName?: string;
  onSuccess?: () => void;
}

export function AdjustStockModal({
  isOpen,
  onClose,
  defaultSiteId,
  defaultItemName,
  onSuccess,
}: AdjustStockModalProps) {
  const { token } = useSession();
  const adjustStockMutation = useMutation(api.movement_actions.adjustStock);

  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>(defaultSiteId || "");
  const [itemName, setItemName] = React.useState<string>(defaultItemName || "");
  const [direction, setDirection] = React.useState<"add" | "subtract">("add");
  const [quantity, setQuantity] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (defaultSiteId) setSelectedSiteId(defaultSiteId);
    if (defaultItemName) setItemName(defaultItemName);
  }, [defaultSiteId, defaultItemName]);

  const siteInventory = useQuery(
    api.movements.getSiteInventory,
    token && selectedSiteId ? { siteId: selectedSiteId as Id<"sites">, token } : "skip"
  );

  const currentItem = siteInventory?.find(
    (i) => i.itemName.toLowerCase() === itemName.toLowerCase().trim()
  );
  const onHandQty = currentItem?.quantity ?? 0;
  const unit = currentItem?.unit || "nos";
  const numQty = parseFloat(quantity) || 0;

  const previewNewBalance =
    direction === "add" ? onHandQty + numQty : onHandQty - numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!selectedSiteId) {
      setError("Please select a construction site.");
      return;
    }
    if (!itemName.trim()) {
      setError("Please specify the item name to adjust.");
      return;
    }
    if (numQty <= 0 || isNaN(numQty)) {
      setError("Please enter a valid adjustment quantity greater than zero.");
      return;
    }
    if (!reason.trim()) {
      setError("A documented audit reason is required for physical inventory adjustments.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await adjustStockMutation({
        siteId: selectedSiteId as Id<"sites">,
        itemName: itemName.trim(),
        adjustmentDirection: direction,
        quantity: numQty,
        reason: reason.trim(),
        token,
      });

      onSuccess?.();
      onClose();
      setQuantity("");
      setReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record audit adjustment.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Scale className="h-5 w-5" />
            <DialogTitle>Physical Stock Audit Adjustment</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Direct count corrections restricted to Project Managers & Administrators.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Site Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Construction Site</Label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              required
            >
              <option value="">Select site...</option>
              {sites?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Item Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Item Name</Label>
              {currentItem && (
                <span className="text-[11px] text-muted-foreground">
                  Current: <strong className="text-foreground">{onHandQty} {unit}</strong>
                </span>
              )}
            </div>
            {siteInventory && siteInventory.length > 0 ? (
              <select
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select inventory item...</option>
                {siteInventory.map((i) => (
                  <option key={i._id} value={i.itemName}>
                    {i.itemName} ({i.quantity} {i.unit})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name..."
                className="h-9 text-xs"
                required
              />
            )}
          </div>

          {/* Direction Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Adjustment Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  direction === "add"
                    ? "border-primary/50 bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Physical Surplus (+ Add)
              </button>
              <button
                type="button"
                onClick={() => setDirection("subtract")}
                className={`h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  direction === "subtract"
                    ? "border-destructive/50 bg-destructive/10 text-destructive font-semibold shadow-xs"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <MinusCircle className="h-3.5 w-3.5" />
                Count Shortage (- Deduct)
              </button>
            </div>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Correction Quantity</Label>
              <Input
                type="number"
                step="any"
                min="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit</Label>
              <Input
                value={unit}
                disabled
                className="h-9 text-xs bg-muted/50 cursor-not-allowed uppercase font-mono"
              />
            </div>
          </div>

          {/* Live Balance Preview Box */}
          {numQty > 0 && (
            <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Adjusted Balance Preview:</span>
              <div className="font-mono font-bold flex items-center gap-1.5">
                <span className="text-muted-foreground">{onHandQty}</span>
                <span>→</span>
                <span className={previewNewBalance < 0 ? "text-destructive" : "text-foreground"}>
                  {previewNewBalance.toFixed(2)} {unit}
                </span>
              </div>
            </div>
          )}

          {/* Mandatory Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Documented Audit Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual physical count variance, scrap write-off..."
              className="h-9 text-xs"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedSiteId || !itemName || numQty <= 0 || !reason.trim()}
              className="text-xs gap-1.5"
            >
              <Scale className="h-3.5 w-3.5" />
              {isSubmitting ? "Posting..." : "Record Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
