import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSimpleInvoiceManagerBackup } from "./simImport";

function fixture(name: string) {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

describe("simple invoice manager import", () => {
  it("parses sanitized SIM JSON into app migration records", () => {
    const migration = parseSimpleInvoiceManagerBackup(fixture("simple-invoice-manager-sanitized.sim"));

    expect(migration.source.format).toBe("simple-invoice-manager-json");
    expect(migration.clients).toHaveLength(1);
    expect(migration.products).toHaveLength(1);
    expect(migration.invoices).toHaveLength(1);
    expect(migration.receipts).toHaveLength(1);
    expect(migration.clients[0]).toMatchObject({
      id: "SIM-CLI-client-alpha",
      name: "Alpha Client",
      email: "alpha@example.com",
    });
    expect(migration.products[0]).toMatchObject({
      id: "SIM-PRD-product-consulting",
      type: "service",
      salePrice: 75,
    });
    expect(migration.invoices[0]).toMatchObject({
      id: "SIM-INV-invoice-100",
      clientId: "SIM-CLI-client-alpha",
      status: "paid",
      amount: 150,
    });
    expect(migration.invoices[0].items[0]).toMatchObject({
      id: "SIM-PRD-product-consulting",
      description: "Consulting Hour",
      quantity: 2,
      unitPrice: 75,
      subtotal: 150,
    });
    expect(migration.receipts[0]).toMatchObject({
      id: "SIM-PAY-payment-100",
      invoiceId: "SIM-INV-invoice-100",
      amount: 150,
      paymentMethod: "Cash",
    });
    expect(migration.unsupportedCounts.tbl_expenses).toBe(1);
  });

  it("rejects unsupported SIM files", () => {
    expect(() => parseSimpleInvoiceManagerBackup("{}")).toThrow("missing InvoiceTBLs");
  });
});
