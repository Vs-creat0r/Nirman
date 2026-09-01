"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Trash2,
  Scale,
  RotateCcw,
} from "lucide-react";

interface ItemLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: Id<"sites"> | null;
  itemName: string | null;
}

interface MovementRow {
  _id: Id<"stock_movements">;
  _creationTime: number;
  movementType: string;
  quantity: number;
  unit: string;
  adjustmentDirection?: "add" | "subtract";
  balanceAfter: number;
  purpose?: string;
  sourceType?: string;
}

export function ItemLedgerModal({
  isOpen,
  onClose,
  siteId,
  itemName,
}: ItemLedgerModalProps) {
  const { token } = useSession();
  const currentUser = useQuery(api.users.getMyUser, token ? { token } : "skip");
  const reverseMutation = useMutation(api.movement_actions.reverseMovement);

  const ledgerData = useQuery(
    api.movements.getItemMovementLedger,
    token && siteId && itemName
      ? { siteId, itemName, token }
      : "skip"
  );

  const [reversingMovementId, setReversingMovementId] = React.useState<string | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");
  const [isReversing, setIsReversing] = React.useState(false);
  const [reversalError, setReversalError] = React.useState<string | null>(null);

  const canReverse =
    currentUser?.role === "admin" || currentUser?.role === "project_manager";

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !reversingMovementId || !reversalReason.trim()) return;

    try {
      setIsReversing(true);
      setReversalError(null);

      await reverseMutation({
        movementId: reversingMovementId as Id<"stock_movements">,
        reason: reversalReason.trim(),
        token,
      });

      setReversingMovementId(null);
      setReversalReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reverse movement.";
      setReversalError(msg);
    } finally {
      setIsReversing(false);
    }
  };

  const renderMovementBadge = (type: string, adjDir?: string) => {
    switch (type) {
      case "receipt":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <ArrowDownLeft className="h-3 w-3 text-primary" /> Receipt (GRN)
          </span>
        );
      case "issue":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" /> Issue to Site
          </span>
        );
      case "transfer_in":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <ArrowRightLeft className="h-3 w-3 text-primary" /> Transfer In
          </span>
        );
      case "transfer_out":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" /> Transfer Out
          </span>
        );
      case "return":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <RotateCcw className="h-3 w-3 text-muted-foreground" /> Vendor Return
          </span>
        );
      case "wastage":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
            <Trash2 className="h-3 w-3" /> Scrap / Wastage
          </span>
        );
      case "adjustment":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Scale className="h-3 w-3 text-primary" /> Audit {adjDir === "add" ? "(+ Gain)" : "(- Loss)"}
          </span>
        );
      case "reversal":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <RotateCcw className="h-3 w-3" /> Reversal
          </span>
        );
      default:
        return <span className="text-[11px] uppercase font-mono">{type}</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-bold text-foreground">
                  {itemName || "Material Ledger"}
                </DialogTitle>
                {ledgerData?.category && (
                  <Badge variant="processing" className="text-[10px] uppercase font-mono">
                    {ledgerData.category}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs">
                Site: <strong className="text-foreground">{ledgerData?.site?.name || "Loading..."}</strong> · Immutable append-only transaction ledger
              </DialogDescription>
            </div>

            {ledgerData && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Current On-Hand</div>
                <div className={`text-xl font-bold font-mono ${ledgerData.currentBalance < 0 ? "text-destructive" : "text-foreground"}`}>
                  {ledgerData.currentBalance} <span className="text-xs font-normal text-muted-foreground uppercase">{ledgerData.unit}</span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Reversal Inline Form */}
        {reversingMovementId && (
          <form onSubmit={handleReverseSubmit} className="p-4 bg-muted/40 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-primary" />
                Reverse Movement ({reversingMovementId})
              </span>
              <button
                type="button"
                onClick={() => setReversingMovementId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            {reversalError && (
              <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded">
                {reversalError}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Documented reason for reversing this movement..."
                className="h-8 text-xs bg-background"
                required
              />
              <Button type="submit" size="sm" disabled={isReversing || !reversalReason.trim()} className="h-8 text-xs shrink-0">
                {isReversing ? "Reversing..." : "Execute Reversal"}
              </Button>
            </div>
          </form>
        )}

        {/* Ledger Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {ledgerData === undefined ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Loading immutable movement ledger...
            </div>
          ) : ledgerData === null || ledgerData.movements.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No stock movements recorded yet for this item.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Movement Type</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Balance After</th>
                    <th className="py-2.5 px-3">Purpose & References</th>
                    {canReverse && <th className="py-2.5 px-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledgerData.movements.map((mov: MovementRow) => {
                    const isPositive =
                      mov.movementType === "receipt" ||
                      mov.movementType === "transfer_in" ||
                      (mov.movementType === "adjustment" && mov.adjustmentDirection === "add");

                    const isReversal = mov.movementType === "reversal";

                    return (
                      <tr key={mov._id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          {new Date(mov._creationTime).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderMovementBadge(mov.movementType, mov.adjustmentDirection)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={isPositive ? "text-foreground font-bold" : "text-muted-foreground"}>
                            {isPositive ? "+" : "-"}{mov.quantity}
                          </span>{" "}
                          <span className="text-[10px] text-muted-foreground uppercase font-normal">{mov.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={mov.balanceAfter < 0 ? "text-destructive" : "text-foreground"}>
                            {mov.balanceAfter}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-xs truncate">
                          {mov.purpose || mov.sourceType || "—"}
                        </td>
                        {canReverse && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {!isReversal && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReversingMovementId(mov._id);
                                  setReversalReason("");
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground font-medium hover:underline"
                              >
                                Reverse
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
