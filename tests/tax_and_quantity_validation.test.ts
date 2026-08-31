import { describe, it, expect } from "vitest";
import { processVendorQuotes } from "../convex/cost_comparisons";

describe("H5 & H6 — Tax Rate & Quantity Validation", () => {
  const validVendorQuotes = [
    {
      vendorId: "vendor_1" as any,
      items: [
        { itemName: "Cement", quantity: 100, unit: "bags", rate: 350 },
      ],
      taxRate: 0, // GST exempt
    },
    {
      vendorId: "vendor_2" as any,
      items: [
        { itemName: "Cement", quantity: 100, unit: "bags", rate: 360 },
      ],
      taxRate: 18,
    },
  ];

  it("H5: preserves 0% tax rate without falling back to 18%", () => {
    const processed = processVendorQuotes(validVendorQuotes);
    const zeroTaxQuote = processed.find((q) => q.vendorId === "vendor_1");
    expect(zeroTaxQuote).toBeDefined();
    expect(zeroTaxQuote?.taxRate).toBe(0);
    expect(zeroTaxQuote?.taxAmount).toBe(0);
    expect(zeroTaxQuote?.subtotal).toBe(35000);
    expect(zeroTaxQuote?.total).toBe(35000);
  });

  it("H6: rejects negative item quantities with descriptive error", () => {
    const negativeQtyQuotes = [
      {
        vendorId: "vendor_1" as any,
        items: [
          { itemName: "Cement", quantity: -500, unit: "bags", rate: 350 },
        ],
        taxRate: 18,
      },
      {
        vendorId: "vendor_2" as any,
        items: [
          { itemName: "Cement", quantity: 100, unit: "bags", rate: 360 },
        ],
        taxRate: 18,
      },
    ];

    expect(() => processVendorQuotes(negativeQtyQuotes)).toThrow(
      /must be a positive number greater than 0/
    );
  });

  it("H6: rejects zero item quantities", () => {
    const zeroQtyQuotes = [
      {
        vendorId: "vendor_1" as any,
        items: [
          { itemName: "Cement", quantity: 0, unit: "bags", rate: 350 },
        ],
        taxRate: 18,
      },
      {
        vendorId: "vendor_2" as any,
        items: [
          { itemName: "Cement", quantity: 100, unit: "bags", rate: 360 },
        ],
        taxRate: 18,
      },
    ];

    expect(() => processVendorQuotes(zeroQtyQuotes)).toThrow(
      /must be a positive number greater than 0/
    );
  });

  it("H6: rejects negative item rates", () => {
    const negativeRateQuotes = [
      {
        vendorId: "vendor_1" as any,
        items: [
          { itemName: "Cement", quantity: 10, unit: "bags", rate: -100 },
        ],
        taxRate: 18,
      },
      {
        vendorId: "vendor_2" as any,
        items: [
          { itemName: "Cement", quantity: 10, unit: "bags", rate: 360 },
        ],
        taxRate: 18,
      },
    ];

    expect(() => processVendorQuotes(negativeRateQuotes)).toThrow(
      /must be a non-negative number/
    );
  });

  it("H6: rejects negative or >100% tax rates", () => {
    const invalidTaxQuotes = [
      {
        vendorId: "vendor_1" as any,
        items: [
          { itemName: "Cement", quantity: 10, unit: "bags", rate: 100 },
        ],
        taxRate: -5,
      },
      {
        vendorId: "vendor_2" as any,
        items: [
          { itemName: "Cement", quantity: 10, unit: "bags", rate: 100 },
        ],
        taxRate: 18,
      },
    ];

    expect(() => processVendorQuotes(invalidTaxQuotes)).toThrow(
      /between 0% and 100%/
    );
  });
});
