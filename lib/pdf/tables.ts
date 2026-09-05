/**
 * @fileoverview Table Builders & Grid Formatters for PDF Generation.
 *
 * Provides multi-page safe table structures with repeating headers (`headerRows: 1`),
 * zebra striping, currency formatting (₹), and responsive columns.
 */

import type { Content, TableCell, Margins } from "pdfmake/interfaces";
import type { PdfDocumentData } from "@/convex/pdf_data";
import { formatInr, formatQty, formatDate } from "@/lib/pdf/styles";

export function buildMetadataGrid(data: PdfDocumentData): Content | null {
  const metaItems: { label: string; value: string }[] = [];

  if (data.priority) metaItems.push({ label: "Priority", value: data.priority.toUpperCase() });
  if (data.requiredBy) metaItems.push({ label: "Required By", value: formatDate(data.requiredBy) });
  if (data.dueDate) metaItems.push({ label: "Quotation Due", value: formatDate(data.dueDate) });
  if (data.expectedDelivery)
    metaItems.push({ label: "Expected Delivery", value: formatDate(data.expectedDelivery) });
  if (data.validUntil) metaItems.push({ label: "Validity", value: formatDate(data.validUntil) });
  if (data.paymentTerms)
    metaItems.push({ label: "Payment Terms", value: data.paymentTerms.replace(/_/g, " ").toUpperCase() });
  if (data.placeOfSupplyStateCode)
    metaItems.push({ label: "Place of Supply", value: `State ${data.placeOfSupplyStateCode}` });
  if (data.vehicleNo) metaItems.push({ label: "Vehicle No", value: data.vehicleNo });
  if (data.driverName)
    metaItems.push({
      label: "Driver",
      value: `${data.driverName}${data.driverPhone ? ` (${data.driverPhone})` : ""}`,
    });
  if (data.dispatchDate)
    metaItems.push({ label: "Dispatched On", value: formatDate(data.dispatchDate) });
  if (data.deliveredAt) metaItems.push({ label: "Delivered On", value: formatDate(data.deliveredAt) });
  if (data.invoiceNumber) metaItems.push({ label: "Invoice No", value: data.invoiceNumber });

  if (metaItems.length === 0) return null;

  const metaCells: TableCell[][] = [];
  const numCols = Math.min(metaItems.length, 4);
  const colWidths = Array(numCols).fill("*");

  const row1: TableCell[] = [];
  for (let i = 0; i < numCols; i++) {
    const item = metaItems[i];
    row1.push({
      stack: [
        { text: item.label.toUpperCase(), fontSize: 7.5, bold: true, color: "#64748B" },
        { text: item.value, fontSize: 8.5, bold: true, color: "#0F172A", margin: [0, 1, 0, 0] as Margins },
      ],
      fillColor: "#F8FAFC",
      margin: [4, 4, 4, 4] as Margins,
    });
  }
  metaCells.push(row1);

  if (metaItems.length > 4) {
    const row2: TableCell[] = [];
    for (let i = 4; i < Math.min(metaItems.length, 8); i++) {
      const item = metaItems[i];
      row2.push({
        stack: [
          { text: item.label.toUpperCase(), fontSize: 7.5, bold: true, color: "#64748B" },
          { text: item.value, fontSize: 8.5, bold: true, color: "#0F172A", margin: [0, 1, 0, 0] as Margins },
        ],
        fillColor: "#F8FAFC",
        margin: [4, 4, 4, 4] as Margins,
      });
    }
    while (row2.length < numCols) {
      row2.push({ text: "", fillColor: "#F8FAFC" });
    }
    metaCells.push(row2);
  }

  return {
    table: {
      widths: colWidths,
      body: metaCells,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#E2E8F0",
      vLineColor: () => "#E2E8F0",
    },
    margin: [0, 0, 0, 14],
  };
}

export function buildQuoteComparisonTable(data: PdfDocumentData): Content | null {
  if (data.docType !== "cost_comparison" || !data.quotes || data.quotes.length === 0) {
    return null;
  }

  const ccHeaders: TableCell[] = [
    { text: "#", style: "tableHeader", alignment: "center" },
    { text: "Vendor Name", style: "tableHeader" },
    { text: "GSTIN", style: "tableHeader" },
    { text: "Subtotal", style: "tableHeader", alignment: "right" },
    { text: "Tax (GST)", style: "tableHeader", alignment: "right" },
    { text: "Freight", style: "tableHeader", alignment: "right" },
    { text: "Total Amount", style: "tableHeader", alignment: "right" },
    { text: "Status", style: "tableHeader", alignment: "center" },
  ];

  const ccRows: TableCell[][] = [ccHeaders];

  data.quotes.forEach((q, idx) => {
    const isSelected = q.isSelected;
    const rowBg = isSelected ? "#ECFDF5" : idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
    ccRows.push([
      { text: (idx + 1).toString(), alignment: "center", fontSize: 8.5, fillColor: rowBg },
      { text: q.vendorName, bold: isSelected, fontSize: 8.5, fillColor: rowBg },
      { text: q.gstin || "—", fontSize: 8, color: "#64748B", fillColor: rowBg },
      { text: formatInr(q.subtotal), alignment: "right", fontSize: 8.5, fillColor: rowBg },
      { text: formatInr(q.taxAmount), alignment: "right", fontSize: 8.5, fillColor: rowBg },
      { text: formatInr(q.freight || 0), alignment: "right", fontSize: 8.5, fillColor: rowBg },
      { text: formatInr(q.total), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
      {
        text: isSelected ? "SELECTED" : "QUOTED",
        alignment: "center",
        bold: true,
        fontSize: 7.5,
        color: isSelected ? "#16A34A" : "#64748B",
        fillColor: rowBg,
      },
    ]);
  });

  return {
    stack: [
      { text: "VENDOR QUOTATIONS & COMPARISON", style: "sectionHeading" },
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 75, 65, 55, 50, 75, 55],
          body: ccRows,
        },
        layout: "lightHorizontalLines",
        margin: [0, 4, 0, 14],
      },
    ],
  };
}

export function buildLineItemsTable(data: PdfDocumentData): Content {
  const tableRows: TableCell[][] = [];

  if (data.docType === "purchase_order") {
    tableRows.push([
      { text: "#", style: "tableHeader", alignment: "center" },
      { text: "Item Description", style: "tableHeader" },
      { text: "HSN/SAC", style: "tableHeader", alignment: "center" },
      { text: "Qty", style: "tableHeader", alignment: "right" },
      { text: "Unit", style: "tableHeader", alignment: "center" },
      { text: "Rate (₹)", style: "tableHeader", alignment: "right" },
      { text: "Amount (₹)", style: "tableHeader", alignment: "right" },
    ]);

    data.lineItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
      const stackContent: Content[] = [
        { text: item.itemName, bold: true, fontSize: 8.5, color: "#0F172A" },
      ];
      if (item.description) {
        stackContent.push({
          text: item.description,
          fontSize: 7.5,
          color: "#64748B",
          margin: [0, 1, 0, 0] as Margins,
        });
      }

      tableRows.push([
        { text: (idx + 1).toString(), alignment: "center", fontSize: 8.5, fillColor: rowBg },
        {
          stack: stackContent,
          fillColor: rowBg,
        },
        { text: item.hsnSacCode || "—", alignment: "center", fontSize: 8, color: "#64748B", fillColor: rowBg },
        { text: formatQty(item.quantity), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
        { text: item.unit, alignment: "center", fontSize: 8, color: "#475569", fillColor: rowBg },
        { text: formatInr(item.rate), alignment: "right", fontSize: 8.5, fillColor: rowBg },
        { text: formatInr(item.amount), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        widths: [20, "*", 50, 45, 40, 65, 80],
        body: tableRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 4, 0, 10],
    };
  }

  if (data.docType === "delivery_challan") {
    tableRows.push([
      { text: "#", style: "tableHeader", alignment: "center" },
      { text: "Item Description", style: "tableHeader" },
      { text: "HSN/SAC", style: "tableHeader", alignment: "center" },
      { text: "Ordered Qty", style: "tableHeader", alignment: "right" },
      { text: "Dispatched Qty", style: "tableHeader", alignment: "right" },
      { text: "Unit", style: "tableHeader", alignment: "center" },
    ]);

    data.lineItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
      tableRows.push([
        { text: (idx + 1).toString(), alignment: "center", fontSize: 8.5, fillColor: rowBg },
        { text: item.itemName, bold: true, fontSize: 8.5, fillColor: rowBg },
        { text: item.hsnSacCode || "—", alignment: "center", fontSize: 8, color: "#64748B", fillColor: rowBg },
        { text: formatQty(item.orderedQty ?? item.quantity), alignment: "right", fontSize: 8.5, fillColor: rowBg },
        { text: formatQty(item.dispatchedQty ?? item.quantity), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
        { text: item.unit, alignment: "center", fontSize: 8, color: "#475569", fillColor: rowBg },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        widths: [20, "*", 60, 75, 85, 45],
        body: tableRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 4, 0, 10],
    };
  }

  if (data.docType === "grn") {
    tableRows.push([
      { text: "#", style: "tableHeader", alignment: "center" },
      { text: "Item Description", style: "tableHeader" },
      { text: "Expected Qty", style: "tableHeader", alignment: "right" },
      { text: "Received Qty", style: "tableHeader", alignment: "right" },
      { text: "Unit", style: "tableHeader", alignment: "center" },
    ]);

    data.lineItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
      tableRows.push([
        { text: (idx + 1).toString(), alignment: "center", fontSize: 8.5, fillColor: rowBg },
        { text: item.itemName, bold: true, fontSize: 8.5, fillColor: rowBg },
        { text: formatQty(item.expectedQty ?? item.quantity), alignment: "right", fontSize: 8.5, fillColor: rowBg },
        { text: formatQty(item.receivedQty ?? item.quantity), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
        { text: item.unit, alignment: "center", fontSize: 8, color: "#475569", fillColor: rowBg },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        widths: [20, "*", 90, 90, 50],
        body: tableRows,
      },
      layout: "lightHorizontalLines",
      margin: [0, 4, 0, 10],
    };
  }

  // Material Request / RFQ
  tableRows.push([
    { text: "#", style: "tableHeader", alignment: "center" },
    { text: "Item Description", style: "tableHeader" },
    ...(data.docType === "material_request"
      ? [{ text: "HSN/SAC", style: "tableHeader", alignment: "center" as const }]
      : []),
    { text: "Quantity", style: "tableHeader", alignment: "right" },
    { text: "Unit", style: "tableHeader", alignment: "center" },
  ]);

  data.lineItems.forEach((item, idx) => {
    const rowBg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
    const stackContent: Content[] = [
      { text: item.itemName, bold: true, fontSize: 8.5, color: "#0F172A" },
    ];
    if (item.description) {
      stackContent.push({
        text: item.description,
        fontSize: 7.5,
        color: "#64748B",
        margin: [0, 1, 0, 0] as Margins,
      });
    }

    tableRows.push([
      { text: (idx + 1).toString(), alignment: "center", fontSize: 8.5, fillColor: rowBg },
      {
        stack: stackContent,
        fillColor: rowBg,
      },
      ...(data.docType === "material_request"
        ? [
            {
              text: item.hsnSacCode || "—",
              alignment: "center" as const,
              fontSize: 8,
              color: "#64748B",
              fillColor: rowBg,
            },
          ]
        : []),
      { text: formatQty(item.quantity), alignment: "right", bold: true, fontSize: 8.5, fillColor: rowBg },
      { text: item.unit, alignment: "center", fontSize: 8, color: "#475569", fillColor: rowBg },
    ]);
  });

  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      widths: data.docType === "material_request" ? [20, "*", 70, 70, 50] : [20, "*", 80, 60],
      body: tableRows,
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 10],
  };
}
