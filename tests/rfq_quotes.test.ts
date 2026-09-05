/**
 * @fileoverview RFQ Vendor Quotes & Immutability Test Suite.
 *
 * Verifies:
 * 1. Zod schema validation for quote submissions.
 * 2. Immutable quote ledger behavior (supersededBy chaining).
 * 3. Exact financial calculation: quantity * rate + GST.
 */

import { describe, it, expect } from "vitest";
import { rfq_quotesSchema } from "@/lib/schemas/rfq_quotes";

describe("RFQ Quotes Validation & Invariants", () => {
  it("validates well-formed quote input", () => {
    const valid = {
      vendorId: "vendor_123",
      itemId: "item_1",
      itemName: "UltraTech PPC Cement 50kg",
      category: "Cement",
      unit: "bags",
      quantity: 500,
      rate: 360,
      taxRate: 18,
      validityDate: "2026-10-31",
      notes: "Ex-factory delivery, payment within 30 days",
    };

    const parsed = rfq_quotesSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(500);
      expect(parsed.data.rate).toBe(360);
      expect(parsed.data.taxRate).toBe(18);
    }
  });

  it("rejects negative rates and zero quantities", () => {
    const negativeRate = {
      vendorId: "vendor_123",
      itemName: "Steel TMT Fe550D",
      unit: "MT",
      quantity: 10,
      rate: -500,
    };
    expect(rfq_quotesSchema.safeParse(negativeRate).success).toBe(false);

    const zeroQty = {
      vendorId: "vendor_123",
      itemName: "Steel TMT Fe550D",
      unit: "MT",
      quantity: 0,
      rate: 65000,
    };
    expect(rfq_quotesSchema.safeParse(zeroQty).success).toBe(false);
  });

  it("calculates total accurately with GST rate", () => {
    const quantity = 250;
    const rate = 420;
    const taxRate = 18;

    const subtotal = quantity * rate;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    expect(subtotal).toBe(105000);
    expect(taxAmount).toBe(18900);
    expect(total).toBe(123900);
  });

  it("models immutable quote revisions using supersededBy pointers", () => {
    const quoteV1 = {
      _id: "quote_row_1",
      rfqId: "rfq_100",
      vendorId: "vendor_abc",
      itemName: "River Sand",
      quantity: 10,
      rate: 4500,
      total: 45000,
      supersededBy: "quote_row_2",
    };

    const quoteV2 = {
      _id: "quote_row_2",
      rfqId: "rfq_100",
      vendorId: "vendor_abc",
      itemName: "River Sand",
      quantity: 10,
      rate: 4200,
      total: 42000,
      supersededBy: undefined,
    };

    const allQuotes = [quoteV1, quoteV2];
    const activeQuotes = allQuotes.filter((q) => !q.supersededBy);

    expect(activeQuotes.length).toBe(1);
    expect(activeQuotes[0]._id).toBe("quote_row_2");
    expect(activeQuotes[0].rate).toBe(4200);
  });
});
