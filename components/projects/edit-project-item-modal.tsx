"use client";

import * as React from "react";
import { useMutation } from "convex/react";
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
  Layers,
  AlertTriangle,
  Plus,
  Pencil,
} from "lucide-react";

interface EditProjectItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: Id<"projects">;
  initialItem?: {
    _id: Id<"project_items">;
    itemName: string;
    category?: string;
    subcategory?: string;
    unit: string;
    boqQty: number;
    estimatedRate?: number;
    description?: string;
  } | null;
  onSuccess?: () => void;
}

export function EditProjectItemModal({
  isOpen,
  onClose,
  projectId,
  initialItem,
  onSuccess,
}: EditProjectItemModalProps) {
  const { token } = useSession();
  const createMutation = useMutation(api.project_items.createProjectItem);
  const updateMutation = useMutation(api.project_items.updateProjectItem);

  const [itemName, setItemName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [subcategory, setSubcategory] = React.useState("");
  const [unit, setUnit] = React.useState("nos");
  const [boqQty, setBoqQty] = React.useState("");
  const [estimatedRate, setEstimatedRate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialItem) {
      setItemName(initialItem.itemName);
      setCategory(initialItem.category || "");
      setSubcategory(initialItem.subcategory || "");
      setUnit(initialItem.unit);
      setBoqQty(String(initialItem.boqQty));
      setEstimatedRate(initialItem.estimatedRate ? String(initialItem.estimatedRate) : "");
      setDescription(initialItem.description || "");
    } else {
      setItemName("");
      setCategory("");
      setSubcategory("");
      setUnit("bags");
      setBoqQty("");
      setEstimatedRate("");
      setDescription("");
    }
  }, [initialItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!itemName.trim()) {
      setError("Item name is mandatory.");
      return;
    }
    const qty = parseFloat(boqQty) || 0;
    if (qty < 0) {
      setError("BOQ Quantity cannot be negative.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (initialItem) {
        await updateMutation({
          id: initialItem._id,
          itemName: itemName.trim(),
          category: category.trim() || undefined,
          subcategory: subcategory.trim() || undefined,
          unit: unit.trim(),
          boqQty: qty,
          estimatedRate: estimatedRate ? parseFloat(estimatedRate) : undefined,
          description: description.trim() || undefined,
          token,
        });
      } else {
        await createMutation({
          projectId,
          itemName: itemName.trim(),
          category: category.trim() || undefined,
          subcategory: subcategory.trim() || undefined,
          unit: unit.trim(),
          boqQty: qty,
          estimatedRate: estimatedRate ? parseFloat(estimatedRate) : undefined,
          description: description.trim() || undefined,
          token,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save BOQ item.";
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
            {initialItem ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            <DialogTitle>{initialItem ? "Edit BOQ Line Item" : "Add BOQ Line Item"}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Manage Bill of Quantities budgeted quantities and baseline specifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Item Name <span className="text-destructive">*</span></Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Portland Pozzolana Cement (PPC)"
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Cement, Steel, Electrical"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit <span className="text-destructive">*</span></Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="bags, MT, nos, cum"
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Budgeted BOQ Quantity</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={boqQty}
                onChange={(e) => setBoqQty(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimated Rate (₹ / unit)</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={estimatedRate}
                onChange={(e) => setEstimatedRate(e.target.value)}
                placeholder="₹ 0.00"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description / Specification</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grade 53 IS:12269 specification"
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
              disabled={isSubmitting || !itemName.trim()}
              className="text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              {isSubmitting ? "Saving..." : initialItem ? "Update Item" : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
