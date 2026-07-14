import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isValidDateValue,
  mapImportRows,
  parseCsv,
  suggestColumnMapping,
} from "./csvImport";

function fixture(name: string) {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

describe("csv importer", () => {
  it("imports Google Sheets clients with header aliases and quoted commas", () => {
    const parsed = parseCsv(fixture("clients-google-sheets.csv"));
    const mapping = suggestColumnMapping(parsed.headers, "clients");
    const result = mapImportRows("clients", parsed, mapping);

    expect(parsed.delimiter).toBe(",");
    expect(mapping["Customer Name"]).toBe("name");
    expect(mapping["Phone Number"]).toBe("phone");
    expect(mapping["Email Address"]).toBe("email");
    expect(result.invalid).toEqual([]);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].data.name).toBe("Acme, Lebanon");
  });

  it("imports Excel semicolon suppliers with sep directive", () => {
    const parsed = parseCsv(fixture("suppliers-excel-semicolon.csv"));
    const mapping = suggestColumnMapping(parsed.headers, "suppliers");
    const result = mapImportRows("suppliers", parsed, mapping);

    expect(parsed.delimiter).toBe(";");
    expect(parsed.headerRow).toBe(2);
    expect(mapping["Supplier Name"]).toBe("name");
    expect(result.invalid).toEqual([]);
    expect(result.valid.map(row => row.data.name)).toEqual(["Initech", "Hooli"]);
  });

  it("imports UTF-8 BOM products and preserves quoted values", () => {
    const parsed = parseCsv(fixture("products-utf8-bom.csv"));
    const mapping = suggestColumnMapping(parsed.headers, "products");
    const result = mapImportRows("products", parsed, mapping);

    expect(parsed.headers[0]).toBe("Product Name");
    expect(mapping["Product Name"]).toBe("name");
    expect(mapping["Sale Price"]).toBe("salePrice");
    expect(result.invalid).toEqual([]);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].data.description).toBe("Single origin, Ethiopia");
  });

  it("reports required fields, invalid email, and uploaded-file duplicates with source columns", () => {
    const parsed = parseCsv(fixture("clients-invalid.csv"));
    const mapping = suggestColumnMapping(parsed.headers, "clients");
    const result = mapImportRows("clients", parsed, mapping);

    expect(result.invalid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          field: "name",
          sourceColumn: "Client Name",
          reason: "Missing required 'name' in source column 'Client Name'",
        }),
        expect.objectContaining({
          row: 4,
          field: "email",
          sourceColumn: "Email Address",
          reason: "Invalid email 'not-an-email' in source column 'Email Address'",
        }),
        expect.objectContaining({
          row: 6,
          field: "name",
          sourceColumn: "Client Name",
          reason: "Duplicate name 'Dup Client' found in file (source column 'Client Name')",
        }),
      ])
    );
  });

  it("shows existing duplicate records as warnings so skip/update can still run", () => {
    const parsed = parseCsv(fixture("clients-google-sheets.csv"));
    const mapping = suggestColumnMapping(parsed.headers, "clients");
    const result = mapImportRows("clients", parsed, mapping, [{ name: "Globex" }]);

    expect(result.invalid).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        row: 3,
        field: "name",
        sourceColumn: "Customer Name",
      }),
    ]);
    expect(result.valid).toHaveLength(2);
  });

  it("validates date values for date-capable import fields", () => {
    expect(isValidDateValue("2026-01-15")).toBe(true);
    expect(isValidDateValue("not-a-date")).toBe(false);
  });
});
