"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { DocumentType } from "@/components/document/document-view";

export interface DocumentPdfDownloadProps {
  docType: DocumentType;
  docId: string;
  refNo: string;
  className?: string;
}

/**
 * Modular PDF Download Action Button.
 *
 * Implements T3:
 * Allows authorized users to trigger server-side vector PDF generation
 * and initiate immediate browser download of the generated PDF file.
 */
export function DocumentPdfDownload({
  docType,
  docId,
  refNo,
  className = "gap-1.5 text-xs font-semibold",
}: DocumentPdfDownloadProps) {
  const { token } = useSession();
  const generatePdf = useAction(api.pdf.generateDocumentPdf);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDownload = async () => {
    if (isGenerating || !docId) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generatePdf({
        docType,
        docId,
        token: token || undefined,
      });

      if (!result?.url) {
        throw new Error("No download URL returned from PDF generation service.");
      }

      // Trigger browser download via invisible anchor
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.filename || `${refNo || "document"}.pdf`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={isGenerating || !docId}
        className={className}
        title={error || `Download ${refNo} PDF`}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {isGenerating ? "Generating PDF…" : "Download PDF"}
      </Button>
      {error && (
        <span className="text-[10px] text-[--destructive] font-medium mt-1 max-w-[200px] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
