"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface ActiveModalAction {
  name: string;
  label: string;
  requiresNote: boolean;
}

interface DocumentActionModalProps {
  activeAction: ActiveModalAction | null;
  refNo: string;
  onClose: () => void;
  onConfirm: (actionName: string, note?: string) => Promise<void>;
  isExecuting: boolean;
  actionError: string | null;
}

export function getActionVariant(name: string) {
  if (name === "approve" || name === "accept") return "primary" as const;
  if (name === "reject" || name === "cancel") return "destructive" as const;
  if (name === "query") return "outline" as const;
  return "primary" as const;
}

export function DocumentActionModal({
  activeAction,
  refNo,
  onClose,
  onConfirm,
  isExecuting,
  actionError,
}: DocumentActionModalProps) {
  const [modalNote, setModalNote] = React.useState("");

  React.useEffect(() => {
    if (activeAction) {
      setModalNote("");
    }
  }, [activeAction]);

  if (!activeAction) return null;

  const handleSubmit = async () => {
    if (activeAction.requiresNote && !modalNote.trim()) {
      return;
    }
    await onConfirm(activeAction.name, modalNote.trim() || undefined);
  };

  return (
    <Dialog open={Boolean(activeAction)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{activeAction.label}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Confirm execution of {activeAction.label.toLowerCase()} on {refNo}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="modal-action-note">
              {activeAction.requiresNote ? "Reason / Clarification Note" : "Note (Optional)"}{" "}
              {activeAction.requiresNote && <span className="text-[--destructive] font-bold">*</span>}
            </Label>
            <textarea
              id="modal-action-note"
              value={modalNote}
              onChange={(e) => setModalNote(e.target.value)}
              placeholder={
                activeAction.requiresNote
                  ? "Explain reason or clarification instructions (required)…"
                  : "Add an optional note…"
              }
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {actionError && (
            <div className="p-2 rounded bg-[--destructive]/10 border border-[--destructive]/20 text-[--destructive] text-[11px] font-semibold">
              {actionError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isExecuting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={getActionVariant(activeAction.name)}
            size="sm"
            onClick={handleSubmit}
            disabled={isExecuting || (activeAction.requiresNote && !modalNote.trim())}
            className="text-xs font-semibold"
          >
            {isExecuting ? "Submitting…" : activeAction.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
