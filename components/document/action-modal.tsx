"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type ActionType = "approve" | "reject" | "query";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: ActionType;
  documentTitle: string;
  onConfirm: (note?: string) => Promise<void>;
  isLoading?: boolean;
}

export function ActionModal({
  isOpen,
  onClose,
  actionType,
  documentTitle,
  onConfirm,
  isLoading = false,
}: ActionModalProps) {
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setNote("");
      setError(null);
    }
  }, [isOpen]);

  const isNoteRequired = actionType === "reject" || actionType === "query";

  const config = {
    approve: {
      title: "Approve Material Request",
      description: `Authorize ${documentTitle} to proceed to procurement and vendor cost comparison.`,
      confirmLabel: "Approve Request",
      variant: "primary" as const,
      placeholder: "Add an optional approval note…",
    },
    query: {
      title: "Query Material Request",
      description: `Send ${documentTitle} back to the supervisor for clarification or edits.`,
      confirmLabel: "Send Query",
      variant: "secondary" as const,
      placeholder: "Explain what needs to be changed or clarified (required)…",
    },
    reject: {
      title: "Reject Material Request",
      description: `Decline ${documentTitle}. This request will be permanently rejected.`,
      confirmLabel: "Reject Request",
      variant: "destructive" as const,
      placeholder: "State the reason for rejection (required)…",
    },
  }[actionType];

  const handleConfirm = async () => {
    if (isNoteRequired && !note.trim()) {
      setError("Please provide a note explaining your decision.");
      return;
    }

    try {
      setError(null);
      await onConfirm(note.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit action.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="action-note">
              {actionType === "approve" ? "Approval Note (Optional)" : "Review Note"}{" "}
              {isNoteRequired && <span className="text-destructive font-bold">*</span>}
            </Label>
            <textarea
              id="action-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={config.placeholder}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {error && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-semibold">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            type="button"
            variant={config.variant}
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="text-xs font-semibold"
          >
            {isLoading ? "Submitting…" : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
