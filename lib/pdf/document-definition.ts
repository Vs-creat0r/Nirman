/**
 * @fileoverview Universal Contract-Driven PDF Document Definition.
 *
 * Implements T2:
 * Single shared template rendering all six Nirman document types:
 * Material Request, RFQ, Cost Comparison, Purchase Order, Delivery Challan, GRN.
 */

import type { TDocumentDefinitions, Content, Column, Margins, TableCell } from "pdfmake/interfaces";
import type { PdfDocumentData } from "@/convex/pdf_data";
import {
  DOC_TYPE_LABELS,
  STATUS_COLORS,
  PDF_STYLES,
  formatInr,
  formatDate,
} from "@/lib/pdf/styles";
import {
  buildMetadataGrid,
  buildQuoteComparisonTable,
  buildLineItemsTable,
} from "@/lib/pdf/tables";

export { formatInr, formatQty, formatDate } from "@/lib/pdf/styles";

export function buildDocumentDefinition(data: PdfDocumentData): TDocumentDefinitions {
  const docTitle = DOC_TYPE_LABELS[data.docType] || "DOCUMENT";
  const statusColor = STATUS_COLORS[data.status.toLowerCase()] || "#64748B";

  const content: Content[] = [];

  // 1. Header Banner & Title Block
  content.push({
    columns: [
      {
        width: "*",
        stack: [
          { text: "NIRMAN ERP", style: "brandTitle" },
          { text: "Construction Procurement & Site Operations", style: "brandSubtitle" },
        ],
      },
      {
        width: "auto",
        stack: [
          { text: docTitle, style: "docTitle" },
          {
            columns: [
              { text: "Ref: ", bold: true, color: "#64748B", fontSize: 10, width: "auto" },
              { text: data.refNo, bold: true, color: "#0F172A", fontSize: 10, width: "auto" },
              {
                text: `  [ ${data.status.toUpperCase().replace(/_/g, " ")} ]`,
                bold: true,
                color: statusColor,
                fontSize: 9,
                width: "auto",
              },
            ],
            margin: [0, 2, 0, 0] as Margins,
          },
          {
            text: `Date: ${formatDate(data.createdAt)}`,
            fontSize: 9,
            color: "#64748B",
            margin: [0, 2, 0, 0] as Margins,
          },
        ],
        alignment: "right",
      },
    ],
    margin: [0, 0, 0, 14] as Margins,
  });

  // Divider line
  content.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 523,
        y2: 0,
        lineWidth: 1.5,
        lineColor: "#0F172A",
      },
    ],
    margin: [0, 0, 0, 12] as Margins,
  });

  // 2. Project & Site / Party Information Block
  const infoCols: Column[] = [];

  // Left Column: Project & Delivery Site Location
  const projectSiteStack: Content[] = [
    { text: "PROJECT & LOCATION", style: "sectionHeading" },
    {
      text: [
        { text: "Project: ", bold: true, color: "#475569" },
        { text: data.project ? `${data.project.name} (${data.project.code})` : "—" },
      ],
      fontSize: 9,
      margin: [0, 2, 0, 1] as Margins,
    },
  ];

  if (data.project?.client) {
    projectSiteStack.push({
      text: [
        { text: "Client: ", bold: true, color: "#475569" },
        { text: data.project.client },
      ],
      fontSize: 9,
      margin: [0, 1, 0, 1] as Margins,
    });
  }

  projectSiteStack.push({
    text: [
      { text: "Site: ", bold: true, color: "#475569" },
      { text: data.site ? data.site.name : "Headquarters / Central Store" },
    ],
    fontSize: 9,
    margin: [0, 1, 0, 1] as Margins,
  });

  if (data.site?.address) {
    projectSiteStack.push({
      text: [
        { text: "Address: ", bold: true, color: "#475569" },
        { text: data.site.address },
      ],
      fontSize: 8.5,
      color: "#64748B",
      margin: [0, 1, 0, 1] as Margins,
    });
  }

  infoCols.push({
    width: "50%",
    stack: projectSiteStack,
  });

  // Right Column: Vendor / Supplier Info (if applicable)
  if (data.vendor) {
    const vendorStack: Content[] = [
      { text: "VENDOR / SUPPLIER", style: "sectionHeading" },
      { text: data.vendor.name, bold: true, fontSize: 10, color: "#0F172A", margin: [0, 2, 0, 1] as Margins },
    ];

    if (data.vendor.gstin) {
      vendorStack.push({
        text: [
          { text: "GSTIN: ", bold: true, color: "#475569" },
          { text: data.vendor.gstin },
        ],
        fontSize: 9,
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    if (data.vendor.contactPerson) {
      vendorStack.push({
        text: [
          { text: "Contact: ", bold: true, color: "#475569" },
          { text: data.vendor.contactPerson },
        ],
        fontSize: 9,
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    if (data.vendor.phone || data.vendor.email) {
      vendorStack.push({
        text: [
          { text: "Phone / Email: ", bold: true, color: "#475569" },
          { text: [data.vendor.phone, data.vendor.email].filter(Boolean).join(" • ") },
        ],
        fontSize: 8.5,
        color: "#64748B",
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    if (data.vendor.address) {
      vendorStack.push({
        text: [
          { text: "Address: ", bold: true, color: "#475569" },
          { text: data.vendor.address },
        ],
        fontSize: 8.5,
        color: "#64748B",
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    infoCols.push({
      width: "50%",
      stack: vendorStack,
    });
  } else if (data.vendors && data.vendors.length > 0) {
    const vendorsListStack: Content[] = [
      { text: "INVITED VENDORS", style: "sectionHeading" },
      ...data.vendors.map((v, idx) => ({
        text: `${idx + 1}. ${v.name}${v.gstin ? ` (GST: ${v.gstin})` : ""}`,
        fontSize: 8.5,
        margin: [0, 1, 0, 1] as Margins,
      })),
    ];

    infoCols.push({
      width: "50%",
      stack: vendorsListStack,
    });
  } else {
    // General Metadata
    const generalStack: Content[] = [
      { text: "ORDER & STATUS DETAILS", style: "sectionHeading" },
      {
        text: [
          { text: "Raised By: ", bold: true, color: "#475569" },
          { text: data.creator ? `${data.creator.name} (${data.creator.role})` : "—" },
        ],
        fontSize: 9,
        margin: [0, 2, 0, 1] as Margins,
      },
    ];

    if (data.priority) {
      generalStack.push({
        text: [
          { text: "Priority: ", bold: true, color: "#475569" },
          { text: data.priority.toUpperCase() },
        ],
        fontSize: 9,
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    if (data.requiredBy) {
      generalStack.push({
        text: [
          { text: "Required By: ", bold: true, color: "#475569" },
          { text: formatDate(data.requiredBy) },
        ],
        fontSize: 9,
        margin: [0, 1, 0, 1] as Margins,
      });
    }

    infoCols.push({
      width: "50%",
      stack: generalStack,
    });
  }

  content.push({
    columns: infoCols,
    margin: [0, 0, 0, 12] as Margins,
  });

  // 3. Key Document Metadata Grid
  const metaGrid = buildMetadataGrid(data);
  if (metaGrid) {
    content.push(metaGrid);
  }

  // 4. Cost Comparison Quote Breakdown (if CC document)
  const ccTable = buildQuoteComparisonTable(data);
  if (ccTable) {
    content.push(ccTable);
  }

  // 5. Line Items Table (Multi-page safe with repeating headers)
  content.push({ text: "ITEMIZED PARTICULARS", style: "sectionHeading" });
  content.push(buildLineItemsTable(data));

  // 6. Financial Summary (PO & CC Grand Totals)
  if (data.totalAmount !== undefined || data.subtotal !== undefined) {
    const summaryRows: TableCell[][] = [];

    if (data.subtotal !== undefined) {
      summaryRows.push([
        { text: "Subtotal:", alignment: "right", fontSize: 8.5, bold: true, color: "#475569" },
        { text: formatInr(data.subtotal), alignment: "right", fontSize: 8.5, color: "#0F172A" },
      ]);
    }

    if (data.freight !== undefined && data.freight > 0) {
      summaryRows.push([
        { text: "Freight / Delivery:", alignment: "right", fontSize: 8.5, color: "#475569" },
        { text: formatInr(data.freight), alignment: "right", fontSize: 8.5, color: "#0F172A" },
      ]);
    }

    if (data.taxAmount !== undefined && data.taxAmount > 0) {
      const taxLabel = data.taxRate ? `Tax / GST (${data.taxRate}%):` : "Tax Amount (GST):";
      summaryRows.push([
        { text: taxLabel, alignment: "right", fontSize: 8.5, color: "#475569" },
        { text: formatInr(data.taxAmount), alignment: "right", fontSize: 8.5, color: "#0F172A" },
      ]);
    }

    if (data.totalAmount !== undefined) {
      summaryRows.push([
        { text: "Grand Total (INR):", alignment: "right", fontSize: 10, bold: true, color: "#0F172A" },
        { text: formatInr(data.totalAmount), alignment: "right", fontSize: 10, bold: true, color: "#0F172A" },
      ]);
    }

    content.push({
      columns: [
        { width: "*", text: "" },
        {
          width: 220,
          table: {
            widths: [110, 110],
            body: summaryRows,
          },
          layout: "noBorders",
        },
      ],
      margin: [0, 4, 0, 14] as Margins,
    });
  }

  // 7. Notes & Terms Block
  const notesStack: Content[] = [];
  if (data.notes) {
    notesStack.push({
      text: [
        { text: "Notes / Special Instructions:\n", bold: true, color: "#475569" },
        { text: data.notes },
      ],
      fontSize: 8.5,
      color: "#334155",
      margin: [0, 0, 0, 4] as Margins,
    });
  }
  if (data.procurementNotes) {
    notesStack.push({
      text: [
        { text: "Procurement Remarks:\n", bold: true, color: "#475569" },
        { text: data.procurementNotes },
      ],
      fontSize: 8.5,
      color: "#334155",
      margin: [0, 0, 0, 4] as Margins,
    });
  }
  if (data.termsAndConditions) {
    notesStack.push({
      text: [
        { text: "Terms & Conditions:\n", bold: true, color: "#475569" },
        { text: data.termsAndConditions },
      ],
      fontSize: 8,
      color: "#64748B",
      margin: [0, 0, 0, 4] as Margins,
    });
  }

  if (notesStack.length > 0) {
    content.push({
      stack: [
        { text: "TERMS & SPECIAL INSTRUCTIONS", style: "sectionHeading" },
        {
          stack: notesStack,
          fillColor: "#F8FAFC",
          margin: [0, 2, 0, 0] as Margins,
        },
      ],
      margin: [0, 4, 0, 14] as Margins,
    });
  }

  // 8. Sign-off / Verification Signatures Block
  const sigCols: Column[] = [];

  sigCols.push({
    width: "33%",
    stack: [
      { text: "Prepared / Raised By", style: "sigHeading" },
      {
        text: data.creator ? data.creator.name : "System",
        bold: true,
        fontSize: 8.5,
        color: "#0F172A",
        margin: [0, 12, 0, 1] as Margins,
      },
      {
        text: data.creator ? data.creator.role.replace(/_/g, " ").toUpperCase() : "CREATOR",
        fontSize: 7.5,
        color: "#64748B",
      },
    ],
  });

  if (data.reviewer) {
    sigCols.push({
      width: "33%",
      stack: [
        { text: "Verified / Approved By", style: "sigHeading" },
        { text: data.reviewer.name, bold: true, fontSize: 8.5, color: "#0F172A", margin: [0, 12, 0, 1] as Margins },
        { text: data.reviewer.role.replace(/_/g, " ").toUpperCase(), fontSize: 7.5, color: "#64748B" },
        ...(data.reviewer.reviewedAt
          ? [{ text: formatDate(data.reviewer.reviewedAt), fontSize: 7.5, color: "#94A3B8" }]
          : []),
      ],
    });
  }

  if (data.confirmer) {
    sigCols.push({
      width: "33%",
      stack: [
        { text: "Received / Confirmed By", style: "sigHeading" },
        { text: data.confirmer.name, bold: true, fontSize: 8.5, color: "#0F172A", margin: [0, 12, 0, 1] as Margins },
        { text: data.confirmer.role.replace(/_/g, " ").toUpperCase(), fontSize: 7.5, color: "#64748B" },
      ],
    });
  }

  content.push({
    columns: sigCols,
    margin: [0, 10, 0, 0] as Margins,
  });

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [36, 36, 36, 36],
    defaultStyle: {
      font: "Roboto",
      fontSize: 8.5,
      color: "#0F172A",
      lineHeight: 1.15,
    },
    styles: PDF_STYLES,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: "Nirman ERP · Confidential & Proprietary",
          fontSize: 7.5,
          color: "#94A3B8",
          width: "*",
        },
        {
          text: `Ref: ${data.refNo}`,
          fontSize: 7.5,
          color: "#94A3B8",
          alignment: "center",
          width: "auto",
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7.5,
          color: "#94A3B8",
          alignment: "right",
          width: "*",
        },
      ],
      margin: [36, 12, 36, 0] as Margins,
    }),
    content,
  };
}
