/**
 * @fileoverview PDF Theme Styles, Color Constants & Currency Formatters.
 *
 * Enforces Nirman Brand palette in vector PDF outputs:
 * Slate 900 (#0F172A), Slate 500 (#64748B), Slate 200 (#E2E8F0), Bronze Amber (#B45309).
 */

import type { StyleDictionary } from "pdfmake/interfaces";
import type { PdfDocType } from "@/convex/pdf_data";

export function formatInr(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹ 0.00";
  return (
    "₹ " +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatQty(qty: number | undefined | null): string {
  if (qty === undefined || qty === null || isNaN(qty)) return "0";
  return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export const DOC_TYPE_LABELS: Record<PdfDocType, string> = {
  material_request: "MATERIAL REQUEST",
  rfq: "REQUEST FOR QUOTATION",
  cost_comparison: "COST COMPARISON SHEET",
  purchase_order: "PURCHASE ORDER",
  delivery_challan: "DELIVERY CHALLAN",
  grn: "GOODS RECEIPT NOTE",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "#64748B",
  pending: "#D97706",
  submitted: "#2563EB",
  open: "#2563EB",
  approved: "#16A34A",
  delivered: "#16A34A",
  closed: "#16A34A",
  rejected: "#DC2626",
  cancelled: "#DC2626",
  queried: "#7C3AED",
  delivery_processing: "#0891B2",
  archived: "#64748B",
};

export const PDF_STYLES: StyleDictionary = {
  brandTitle: {
    fontSize: 14,
    bold: true,
    color: "#0F172A",
  },
  brandSubtitle: {
    fontSize: 8,
    color: "#64748B",
  },
  docTitle: {
    fontSize: 12,
    bold: true,
    color: "#0F172A",
  },
  sectionHeading: {
    fontSize: 8,
    bold: true,
    color: "#B45309",
    margin: [0, 0, 0, 3],
  },
  tableHeader: {
    fontSize: 8,
    bold: true,
    color: "#0F172A",
    fillColor: "#F1F5F9",
  },
  sigHeading: {
    fontSize: 7.5,
    bold: true,
    color: "#64748B",
  },
};
