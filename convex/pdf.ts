/**
 * @fileoverview Vector PDF Generation Action Service.
 *
 * Runs in Convex Node.js runtime ("use node";).
 * Generates true vector text PDF documents with embedded TrueType fonts,
 * stores them in Convex file storage, and returns an authenticated download URL.
 */

"use node";

import { action } from "@/convex/_generated/server";
import { internal } from "@/convex/_generated/api";
import { v } from "convex/values";
import { PDF_VFS, PDF_FONTS } from "@/lib/pdf/fonts";
import { buildDocumentDefinition } from "@/lib/pdf/document-definition";
import type { PdfDocumentData } from "@/convex/pdf_data";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake");

let isInitialized = false;
function initializePdfMake(): void {
  if (!isInitialized) {
    for (const [filename, base64] of Object.entries(PDF_VFS)) {
      pdfmake.virtualfs.writeFileSync(filename, Buffer.from(base64, "base64"));
    }
    pdfmake.setFonts(PDF_FONTS);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(() => false);
    isInitialized = true;
  }
}

export async function renderPdfBuffer(docData: PdfDocumentData): Promise<Buffer> {
  initializePdfMake();
  const docDef = buildDocumentDefinition(docData);
  const pdfDoc = pdfmake.createPdf(docDef);
  return await pdfDoc.getBuffer();
}

export const generateDocumentPdf = action({
  args: {
    docType: v.union(
      v.literal("material_request"),
      v.literal("rfq"),
      v.literal("cost_comparison"),
      v.literal("purchase_order"),
      v.literal("delivery_challan"),
      v.literal("grn")
    ),
    docId: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const docData: PdfDocumentData = await ctx.runQuery(
      internal.pdf_data.getDocumentForPdf,
      {
        docType: args.docType,
        docId: args.docId,
        token: args.token,
      }
    );

    const buffer = await renderPdfBuffer(docData);

    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(buffer)], { type: "application/pdf" })
    );

    const url = await ctx.storage.getUrl(storageId);

    return {
      storageId,
      url,
      filename: `${docData.refNo}.pdf`,
    };
  },
});
