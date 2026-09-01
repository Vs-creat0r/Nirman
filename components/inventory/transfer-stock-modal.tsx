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
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

interface TransferStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSourceSiteId?: Id<"sites">;
  defaultItemName?: string;
  onSuccess?: () => void;
}

export function TransferStockModal({
  isOpen,
  onClose,
  defaultSourceSiteId,
  defaultItemName,
  onSuccess,
}: TransferStockModalProps) {
  const { token } = useSession();
  const transferStockMutation = useMutation(api.movement_actions.transferStock);

  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const [sourceSiteId, setSourceSiteId] = React.useState<string>(defaultSourceSiteId || "");
  const [destinationSiteId, setDestinationSiteId] = React.useState<string>("");
  const [itemName, setItemName] = React.useState<string>(defaultItemName || "");
  const [quantity, setQuantity] = React.useState<string>("");
  const [purpose, setPurpose] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (defaultSourceSiteId) setSourceSiteId(defaultSourceSiteId);
    if (defaultItemName) setItemName(defaultItemName);
  }, [defaultSourceSiteId, defaultItemName]);

  const sourceInventory = useQuery(
    api.movements.getSiteInventory,
    token && sourceSiteId ? { siteId: sourceSiteId as Id<"sites">, token } : "skip"
  );

  const currentItem = sourceInventory?.find(
    (i) => i.itemName.toLowerCase() === itemName.toLowerCase().trim()
  );
  const onHandQty = currentItem?.quantity ?? 0;
  const unit = currentItem?.unit || "nos";
  const numQty = parseFloat(quantity) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!sourceSiteId) {
      setError("Please select the source site.");
      return;
    }
    if (!destinationSiteId) {
      setError("Please select the destination site.");
      return;
    }
    if (sourceSiteId === destinationSiteId) {
      setError("Source and destination sites must be different.");
      return;
    }
    if (!itemName.trim()) {
      setError("Please select an item to transfer.");
      return;
    }
    if (numQty <= 0 || isNaN(numQty)) {
      setError("Please enter a valid quantity greater than zero.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await transferStockMutation({
        sourceSiteId: sourceSiteId as Id<"sites">,
        destinationSiteId: destinationSiteId as Id<"sites">,
        itemName: itemName.trim(),
        quantity: numQty,
        purpose: purpose.trim() || `Inter-site transfer to site ${destinationSiteId}`,
        token,
      });

      onSuccess?.();
      onClose();
      setQuantity("");
      setPurpose("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer stock.";
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
            <ArrowRightLeft className="h-5 w-5" />
            <DialogTitle>Inter-Site Stock Transfer</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Atomically move materials between project sites with linked ledger lineage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sites Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Source Site (Out)</Label>
              <select
                value={sourceSiteId}
                onChange={(e) => setSourceSiteId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select source...</option>
                {sites?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Destination Site (In)</Label>
              <select
                value={destinationSiteId}
                onChange={(e) => setDestinationSiteId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select dest...</option>
                {sites
                  ?.filter((s) => s._id !== sourceSiteId)
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Item Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Item to Transfer</Label>
              {currentItem && (
                <span className="text-[11px] text-muted-foreground">
                  Source On-hand: <strong className="text-foreground">{onHandQty} {unit}</strong>
                </span>
              )}
            </div>
            {sourceInventory && sourceInventory.length > 0 ? (
              <select
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select item from source site...</option>
                {sourceInventory.map((i) => (
                  <option key={i._id} value={i.itemName}>
                    {i.itemName} ({i.quantity} {i.unit} available)
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

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quantity to Transfer</Label>
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

          {/* Purpose / Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Transfer Reason / Challan Reference</Label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Urgent shortfall transfer for Tower B slab casting..."
              className="h-9 text-xs"
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
              disabled={isSubmitting || !sourceSiteId || !destinationSiteId || !itemName || numQty <= 0}
              className="text-xs gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {isSubmitting ? "Transferring..." : "Execute 2-Site Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
