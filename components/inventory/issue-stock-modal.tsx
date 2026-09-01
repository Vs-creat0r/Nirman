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
  PackageMinus,
  AlertTriangle,
  Layers,
} from "lucide-react";

interface IssueStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSiteId?: Id<"sites">;
  defaultItemName?: string;
  onSuccess?: () => void;
}

export function IssueStockModal({
  isOpen,
  onClose,
  defaultSiteId,
  defaultItemName,
  onSuccess,
}: IssueStockModalProps) {
  const { token } = useSession();
  const issueStockMutation = useMutation(api.movement_actions.issueStock);

  const sites = useQuery(api.sites.listSites, token ? { token } : "skip");
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>(defaultSiteId || "");
  const [itemName, setItemName] = React.useState<string>(defaultItemName || "");
  const [quantity, setQuantity] = React.useState<string>("");
  const [purpose, setPurpose] = React.useState<string>("");
  const [selectedProjectItemId, setSelectedProjectItemId] = React.useState<string>("");
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

  const selectedSite = sites?.find((s) => s._id === selectedSiteId);
  const projectItems = useQuery(
    api.project_items.listProjectItems,
    token && selectedSite ? { projectId: selectedSite.projectId, token } : "skip"
  );

  const currentInventoryItem = siteInventory?.find(
    (i) => i.itemName.toLowerCase() === itemName.toLowerCase().trim()
  );

  const onHandQty = currentInventoryItem?.quantity ?? 0;
  const unit = currentInventoryItem?.unit || "nos";
  const numQty = parseFloat(quantity) || 0;
  const isNegativeStockWarning = numQty > onHandQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!selectedSiteId) {
      setError("Please select a construction site.");
      return;
    }
    if (!itemName.trim()) {
      setError("Please specify the item name to issue.");
      return;
    }
    if (numQty <= 0 || isNaN(numQty)) {
      setError("Please specify a valid quantity greater than zero.");
      return;
    }
    if (!purpose.trim()) {
      setError("A specific purpose / usage location is mandatory for material issuance.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await issueStockMutation({
        siteId: selectedSiteId as Id<"sites">,
        itemName: itemName.trim(),
        quantity: numQty,
        purpose: purpose.trim(),
        projectItemId: selectedProjectItemId ? (selectedProjectItemId as Id<"project_items">) : undefined,
        token,
      });

      onSuccess?.();
      onClose();
      setQuantity("");
      setPurpose("");
      setSelectedProjectItemId("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to issue stock.";
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
            <PackageMinus className="h-5 w-5" />
            <DialogTitle>Issue Stock to Consumption</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Record physical material issuance from site inventory to field work.
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

          {/* Item Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Item Name</Label>
              {currentInventoryItem && (
                <span className="text-[11px] text-muted-foreground">
                  On-hand: <strong className="text-foreground">{onHandQty} {unit}</strong>
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
                <option value="">Select on-hand inventory item...</option>
                {siteInventory.map((i) => (
                  <option key={i._id} value={i.itemName}>
                    {i.itemName} ({i.quantity} {i.unit} on-hand)
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Cement OPC 53, TMT 12mm..."
                className="h-9 text-xs"
                required
              />
            )}
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quantity to Issue</Label>
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

          {/* Negative Stock Warning Alert */}
          {isNegativeStockWarning && numQty > 0 && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Negative Stock Notice:</strong> Issuing {numQty} {unit} exceeds on-hand balance ({onHandQty} {unit}). Resulting balance will be {(onHandQty - numQty).toFixed(2)} {unit}.
              </div>
            </div>
          )}

          {/* Optional BOQ Link */}
          {projectItems && projectItems.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Linked BOQ Line Item (Optional)
              </Label>
              <select
                value={selectedProjectItemId}
                onChange={(e) => setSelectedProjectItemId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Unlinked / Free-text consumption</option>
                {projectItems.map((pi) => (
                  <option key={pi._id} value={pi._id}>
                    {pi.name} ({pi.category || "General"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mandatory Purpose */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Purpose / Location of Use <span className="text-destructive">*</span>
            </Label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. 2nd Floor Column Casting, Grid 4-B slab..."
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
              disabled={isSubmitting || !selectedSiteId || !itemName || numQty <= 0 || !purpose.trim()}
              className="text-xs gap-1.5"
            >
              <PackageMinus className="h-3.5 w-3.5" />
              {isSubmitting ? "Issuing..." : "Confirm Stock Issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
