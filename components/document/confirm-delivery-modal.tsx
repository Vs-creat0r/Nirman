"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Clock,
  X,
  FileCheck2,
  Package,
} from "lucide-react";

interface ReceivedItemState {
  itemName: string;
  expectedQty: number;
  receivedQty: number;
  unit: string;
}

interface ConfirmDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryChallan: {
    _id: Id<"delivery_challan">;
    refNo: string;
    poRefNo?: string;
    vehicleNo: string;
    driverName: string;
    vendorName?: string;
    siteName?: string;
    dispatchedItems: Array<{
      itemName: string;
      orderedQty: number;
      dispatchedQty: number;
      unit: string;
    }>;
  };
  onSuccess?: () => void;
}

export function ConfirmDeliveryModal({
  isOpen,
  onClose,
  deliveryChallan,
  onSuccess,
}: ConfirmDeliveryModalProps) {
  const router = useRouter();
  const { token } = useSession();

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const confirmDeliveryMutation = useMutation(api.grn.confirmDeliveryAndGenerateGRN);

  // Initialize received items from DC dispatched items
  const [receivedItems, setReceivedItems] = React.useState<ReceivedItemState[]>(() =>
    deliveryChallan.dispatchedItems.map((item) => ({
      itemName: item.itemName,
      expectedQty: item.dispatchedQty,
      receivedQty: item.dispatchedQty,
      unit: item.unit,
    }))
  );

  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  // Uploaded photo storage IDs + local preview URLs
  const [uploadedPhotos, setUploadedPhotos] = React.useState<
    Array<{ storageId: Id<"_storage">; previewUrl: string; name: string }>
  >([]);

  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleQtyChange = (index: number, val: number) => {
    setReceivedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], receivedQty: val };
      return copy;
    });
  };

  // Upload photo handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploadingPhoto(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          setError(`File "${file.name}" is not an image.`);
          continue;
        }

        // 1. Get upload URL from Convex
        const postUrl = await generateUploadUrl({ token: token || undefined });

        // 2. Upload file to Convex storage
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!result.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await result.json();

        // 3. Create local preview
        const previewUrl = URL.createObjectURL(file);

        setUploadedPhotos((prev) => [
          ...prev,
          { storageId, previewUrl, name: file.name },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to upload photo.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  // Check if any discrepancy exists
  const hasDiscrepancies = receivedItems.some(
    (item) => item.receivedQty !== item.expectedQty
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadedPhotos.length === 0) {
      setError("At least 1 unloading proof photo is required to confirm goods receipt.");
      return;
    }

    for (const item of receivedItems) {
      if (isNaN(item.receivedQty) || item.receivedQty < 0) {
        setError(`Received quantity for "${item.itemName}" cannot be negative.`);
        return;
      }
      if (item.receivedQty > item.expectedQty) {
        setError(
          `Received quantity (${item.receivedQty}) for "${item.itemName}" cannot exceed dispatched quantity (${item.expectedQty} ${item.unit}). Over-delivery is not allowed.`
        );
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const photoIds = uploadedPhotos.map((p) => p.storageId);

      await confirmDeliveryMutation({
        deliveryChallanId: deliveryChallan._id,
        receivedItems,
        photos: photoIds,
        invoiceNumber: invoiceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        token: token || undefined,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/grn");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to confirm delivery and generate GRN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Confirm Delivery & Auto-Generate GRN
              </h2>
              <p className="text-xs text-muted-foreground">
                Verify received quantities and upload mandatory unloading proof photos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Shipment Summary Card */}
          <div className="p-3.5 rounded-lg border border-border bg-surface/50 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div>
                <span className="text-[11px] text-muted-foreground">Challan Ref:</span>
                <span className="ml-1.5 font-mono font-bold text-foreground">
                  {deliveryChallan.refNo}
                </span>
              </div>
              {deliveryChallan.poRefNo && (
                <div>
                  <span className="text-[11px] text-muted-foreground">PO Ref:</span>
                  <span className="ml-1.5 font-mono text-muted-foreground">
                    {deliveryChallan.poRefNo}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
              <div>
                <span className="text-muted-foreground">Vehicle:</span>
                <p className="font-mono font-medium text-foreground">
                  {deliveryChallan.vehicleNo}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Driver:</span>
                <p className="font-medium text-foreground">{deliveryChallan.driverName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-medium text-foreground">
                  {deliveryChallan.vendorName || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Received Line Items Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Physical Quantity Verification
              </Label>
              {hasDiscrepancies && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Quantity Discrepancy
                </span>
              )}
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Expected Qty</th>
                    <th className="px-3 py-2 text-right">Received Qty</th>
                    <th className="px-3 py-2">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receivedItems.map((item, idx) => {
                    const isDiff = item.receivedQty !== item.expectedQty;
                    return (
                      <tr
                        key={idx}
                        className={isDiff ? "bg-amber-500/5" : "hover:bg-muted/20"}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {item.itemName}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {item.expectedQty}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.expectedQty}
                            step="any"
                            value={item.receivedQty}
                            onChange={(e) =>
                              handleQtyChange(idx, parseFloat(e.target.value) || 0)
                            }
                            className={`w-24 px-2 py-1 text-right bg-surface border rounded text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-ring ${
                              item.receivedQty > item.expectedQty
                                ? "border-destructive text-destructive font-bold"
                                : isDiff
                                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                                : "border-input text-foreground"
                            }`}
                            required
                          />
                          {item.receivedQty > item.expectedQty && (
                            <span className="text-[9px] text-destructive block mt-0.5">
                              Max: {item.expectedQty}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mandatory Unloading Photo Upload Zone (D2) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-primary" />
                Unloading Proof Photos <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Mandatory proof of delivery (Stored via Convex Storage)
              </span>
            </div>

            {/* Dropzone button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-xl p-5 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Upload className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Click to upload unloading photos
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Supports JPG, PNG, WebP (Camera upload enabled on mobile)
              </p>
            </div>

            {/* Uploading progress indicator */}
            {isUploadingPhoto && (
              <div className="flex items-center justify-center gap-2 p-2 bg-primary/5 rounded-lg text-xs text-primary">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading photo to storage...</span>
              </div>
            )}

            {/* Thumbnail Gallery */}
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {uploadedPhotos.map((photo, i) => (
                  <div
                    key={i}
                    className="relative group rounded-lg overflow-hidden border border-border bg-surface aspect-square"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(i);
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-destructive text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Number & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Vendor Invoice / Bill Number
              </Label>
              <Input
                placeholder="e.g. INV-2026-908"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Receiver Remarks / Notes
              </Label>
              <Input
                placeholder="e.g. Material inspected; no transit damages found."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Submit / Cancel Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
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
              disabled={isSubmitting || uploadedPhotos.length === 0}
              className="text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  Generating GRN...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Receipt & Generate GRN
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
