"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
  FileSpreadsheet,
  AlertTriangle,
  Upload,
  CheckCircle2,
} from "lucide-react";

interface BoqCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: Id<"projects">;
  onSuccess?: () => void;
}

interface ParsedRow {
  itemName: string;
  category?: string;
  unit: string;
  boqQty: number;
  estimatedRate?: number;
  description?: string;
}

export function BoqCsvImportModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: BoqCsvImportModalProps) {
  const { token } = useSession();
  const bulkImportMutation = useMutation(api.project_items.bulkImportProjectItems);

  const [csvText, setCsvText] = React.useState("");
  const [parsedRows, setParsedRows] = React.useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parseCSV = (text: string) => {
    setError(null);
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    const rows: ParsedRow[] = [];
    const startIndex = lines[0].toLowerCase().includes("item") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length < 3) continue;

      const itemName = cols[0];
      const category = cols[1] || undefined;
      const unit = cols[2];
      const boqQty = parseFloat(cols[3]) || 0;
      const estimatedRate = cols[4] ? parseFloat(cols[4]) : undefined;
      const description = cols[5] || undefined;

      if (itemName && unit) {
        rows.push({
          itemName,
          category,
          unit,
          boqQty,
          estimatedRate,
          description,
        });
      }
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || parsedRows.length === 0) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await bulkImportMutation({
        projectId,
        items: parsedRows,
        token,
      });

      onSuccess?.();
      onClose();
      setCsvText("");
      setParsedRows([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import BOQ items.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <FileSpreadsheet className="h-5 w-5" />
            <DialogTitle>Bulk Import BOQ Line Items (CSV)</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Import bulk Bill of Quantities lines via CSV upload or formatted text paste.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload or Paste */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">CSV Data / Upload</Label>
              <label className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                <Upload className="h-3.5 w-3.5" />
                Upload .csv file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCSV(e.target.value);
              }}
              placeholder={`ItemName, Category, Unit, BOQ Qty, Est Rate, Description\nCement Grade 53, Structural, bags, 1500, 380, Foundation concrete\nTMT 16mm Rebar, Steel, MT, 45, 62000, Column reinforcement\nRed Clay Bricks, Masonry, nos, 25000, 9, External perimeter walls`}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Format: <code>ItemName, Category, Unit, BOQ Qty, Estimated Rate, Description</code>
            </p>
          </div>

          {/* Parsed Preview */}
          {parsedRows.length > 0 && (
            <div className="flex-1 overflow-y-auto border border-border rounded-lg max-h-48">
              <div className="p-2 border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground flex justify-between">
                <span>Parsed Preview ({parsedRows.length} items ready)</span>
                <span className="flex items-center gap-1 text-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary" /> Valid CSV
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground text-[11px]">
                    <th className="p-2">Item</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 text-right">BOQ Qty</th>
                    <th className="p-2">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="p-2 font-medium text-foreground">{r.itemName}</td>
                      <td className="p-2 text-muted-foreground text-[11px]">{r.category || "—"}</td>
                      <td className="p-2 text-right font-mono font-bold">{r.boqQty}</td>
                      <td className="p-2 text-muted-foreground uppercase text-[11px] font-mono">{r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
              disabled={isSubmitting || parsedRows.length === 0}
              className="text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {isSubmitting ? "Importing..." : `Import ${parsedRows.length} Items`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
