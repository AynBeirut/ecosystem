// CSV parser + entity row mappers.
// Pure functions, no I/O. Used by the Settings -> Data Import dialog.

export type CsvRow = Record<string, string>;
export type ImportEntity = "clients" | "suppliers" | "products";
export type DestinationField = string;
export type ColumnMapping = Record<string, DestinationField>;
export type CsvDelimiter = "," | ";";

export interface ParsedCsvRow {
  rowNumber: number;
  values: string[];
  data: CsvRow;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  sourceRows: ParsedCsvRow[];
  delimiter: CsvDelimiter;
  headerRow: number;
  warnings: string[];
}

export interface MappedClient {
  name: string; address: string; phone: string; email: string; taxId?: string;
}
export interface MappedSupplier {
  name: string; address: string; phone: string; email: string;
}
export interface MappedProduct {
  name: string; description?: string;
  type: "product" | "service" | "composed";
  salePrice: number; rawPrice?: number;
  lowStockAlert?: number; sku?: string; category?: string; serviceCost?: number;
}

export interface MappingIssue {
  row: number;
  reason: string;
  field?: string;
  sourceColumn?: string;
  value?: string;
}

export interface MappingResult<T> {
  valid: Array<{ row: number; data: T }>;
  invalid: MappingIssue[];
  warnings: MappingIssue[];
  headers: string[];
  mapping: ColumnMapping;
  missingRequiredFields: string[];
}

export interface ExistingImportRecord {
  name?: string;
  email?: string;
  sku?: string;
}

interface CsvRecord {
  rowNumber: number;
  cells: string[];
}

interface FieldDefinition {
  field: DestinationField;
  label: string;
  aliases: string[];
  required?: boolean;
  type?: "string" | "email" | "number" | "date" | "productType";
  duplicate?: boolean;
}

const FIELD_DEFINITIONS: Record<ImportEntity, FieldDefinition[]> = {
  clients: [
    { field: "name", label: "Name", required: true, duplicate: true, aliases: ["name", "client", "client name", "customer", "customer name", "full name", "company", "company name"] },
    { field: "email", label: "Email", type: "email", duplicate: true, aliases: ["email", "e-mail", "email address", "mail", "contact email"] },
    { field: "phone", label: "Phone", aliases: ["phone", "phone number", "telephone", "mobile", "mobile number", "contact number"] },
    { field: "address", label: "Address", aliases: ["address", "billing address", "street", "location"] },
    { field: "taxId", label: "Tax ID", aliases: ["tax id", "taxid", "tax_id", "vat", "vat number", "trn"] },
  ],
  suppliers: [
    { field: "name", label: "Name", required: true, duplicate: true, aliases: ["name", "supplier", "supplier name", "vendor", "vendor name", "company", "company name"] },
    { field: "email", label: "Email", type: "email", aliases: ["email", "e-mail", "email address", "mail", "contact email"] },
    { field: "phone", label: "Phone", aliases: ["phone", "phone number", "telephone", "mobile", "mobile number", "contact number"] },
    { field: "address", label: "Address", aliases: ["address", "street", "location"] },
  ],
  products: [
    { field: "name", label: "Name", required: true, duplicate: true, aliases: ["name", "product", "product name", "item", "item name", "service", "service name"] },
    { field: "sku", label: "SKU", duplicate: true, aliases: ["sku", "code", "item code", "product code", "barcode"] },
    { field: "type", label: "Type", type: "productType", aliases: ["type", "product type", "item type"] },
    { field: "salePrice", label: "Sale Price", required: true, type: "number", aliases: ["saleprice", "sale price", "price", "unit price", "selling price", "retail price"] },
    { field: "rawPrice", label: "Raw Price", type: "number", aliases: ["rawprice", "raw price", "cost", "cost price", "unit cost", "purchase price"] },
    { field: "category", label: "Category", aliases: ["category", "group", "family"] },
    { field: "lowStockAlert", label: "Low Stock Alert", type: "number", aliases: ["lowstockalert", "low stock alert", "stock alert", "alert", "minimum stock", "min stock"] },
    { field: "description", label: "Description", aliases: ["description", "details", "notes"] },
    { field: "serviceCost", label: "Service Cost", type: "number", aliases: ["servicecost", "service cost", "labor cost", "labour cost"] },
  ],
};

function cleanCell(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

export function normalizeHeader(value: string): string {
  return cleanCell(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function countDelimiter(line: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delimiter) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(text: string): CsvDelimiter {
  const lines = text.split("\n").filter(line => line.trim() !== "").slice(0, 5);
  const commaScore = lines.reduce((sum, line) => sum + countDelimiter(line, ","), 0);
  const semicolonScore = lines.reduce((sum, line) => sum + countDelimiter(line, ";"), 0);
  return semicolonScore > commaScore ? ";" : ",";
}

function parseRecords(text: string, delimiter: CsvDelimiter, firstLineNumber: number): CsvRecord[] {
  const records: CsvRecord[] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let lineNumber = firstLineNumber;
  let recordStartLine = firstLineNumber;

  const pushRecord = () => {
    records.push({ rowNumber: recordStartLine, cells: [...record, field].map(cleanCell) });
    field = "";
    record = [];
    recordStartLine = lineNumber + 1;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
        if (ch === "\n") lineNumber++;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      pushRecord();
      lineNumber++;
      recordStartLine = lineNumber;
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  return records.filter(r => r.cells.some(c => c.trim() !== ""));
}

function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const fallback = `Column ${index + 1}`;
    const base = cleanCell(header) || fallback;
    const key = normalizeHeader(base) || normalizeHeader(fallback);
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/** Parse CSV text into header-keyed rows plus source row metadata. */
export function parseCsv(input: string): ParsedCsv {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) {
    return { headers: [], rows: [], sourceRows: [], delimiter: ",", headerRow: 0, warnings: ["CSV file is empty."] };
  }

  const warnings: string[] = [];
  let text = normalized;
  let firstLineNumber = 1;
  let delimiter: CsvDelimiter | null = null;
  const firstLine = text.split("\n", 1)[0].replace(/^\uFEFF/, "").trim();
  const sepMatch = /^sep\s*=\s*([,;])$/i.exec(firstLine);

  if (sepMatch) {
    delimiter = sepMatch[1] as CsvDelimiter;
    text = text.slice(text.indexOf("\n") + 1);
    firstLineNumber = 2;
    warnings.push(`Excel delimiter directive detected: '${delimiter === ";" ? "semicolon" : "comma"}'.`);
  }

  delimiter = delimiter ?? detectDelimiter(text);
  const cleaned = parseRecords(text, delimiter, firstLineNumber);
  if (cleaned.length === 0) {
    return { headers: [], rows: [], sourceRows: [], delimiter, headerRow: 0, warnings: ["CSV file has no data rows."] };
  }

  const headerRecord = cleaned[0];
  const headers = makeUniqueHeaders(headerRecord.cells);
  const sourceRows = cleaned.slice(1).map(record => {
    const data: CsvRow = {};
    headers.forEach((header, index) => {
      data[header] = cleanCell(record.cells[index] ?? "");
    });
    return { rowNumber: record.rowNumber, values: record.cells, data };
  });

  return {
    headers,
    rows: sourceRows.map(row => row.data),
    sourceRows,
    delimiter,
    headerRow: headerRecord.rowNumber,
    warnings,
  };
}

export function getFieldDefinitions(entity: ImportEntity): FieldDefinition[] {
  return FIELD_DEFINITIONS[entity];
}

export function getDestinationLabel(entity: ImportEntity, field: DestinationField): string {
  return FIELD_DEFINITIONS[entity].find(def => def.field === field)?.label || field;
}

export function suggestColumnMapping(headers: string[], entity: ImportEntity): ColumnMapping {
  const defs = FIELD_DEFINITIONS[entity];
  const used = new Set<string>();
  const mapping: ColumnMapping = {};

  headers.forEach(header => {
    const normalizedHeader = normalizeHeader(header);
    const match = defs.find(def => {
      if (used.has(def.field)) return false;
      return def.aliases.some(alias => normalizeHeader(alias) === normalizedHeader);
    });
    mapping[header] = match?.field || "";
    if (match) used.add(match.field);
  });

  return mapping;
}

function createParsedFromRows(rows: CsvRow[], headers: string[]): ParsedCsv {
  return {
    headers,
    rows,
    sourceRows: rows.map((row, index) => ({
      rowNumber: index + 2,
      values: headers.map(header => row[header] ?? ""),
      data: row,
    })),
    delimiter: ",",
    headerRow: 1,
    warnings: [],
  };
}

function getValue(sourceRow: ParsedCsvRow, headers: string[], mapping: ColumnMapping, field: DestinationField) {
  const sourceColumn = headers.find(header => mapping[header] === field);
  return {
    sourceColumn,
    value: sourceColumn ? cleanCell(sourceRow.data[sourceColumn] ?? "") : "",
  };
}

function toNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9,.-]/g, "").trim();
  const decimalComma = /^-?\d+,\d+$/.test(cleaned) && !cleaned.includes(".");
  const normalized = decimalComma ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function isValidEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidDateValue(value: string): boolean {
  if (!value) return true;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function normalizeKey(value: string): string {
  return cleanCell(value).toLowerCase();
}

function pushDuplicateIssue(
  invalid: MappingIssue[],
  row: number,
  field: string,
  sourceColumn: string | undefined,
  value: string,
  location: "file" | "existing records",
) {
  invalid.push({
    row,
    field,
    sourceColumn,
    value,
    reason: `Duplicate ${field} '${value}' found in ${location}${sourceColumn ? ` (source column '${sourceColumn}')` : ""}`,
  });
}

export function mapImportRows<T extends MappedClient | MappedSupplier | MappedProduct>(
  entity: ImportEntity,
  parsed: ParsedCsv,
  mapping: ColumnMapping = suggestColumnMapping(parsed.headers, entity),
  existingRecords: ExistingImportRecord[] = [],
): MappingResult<T> {
  const defs = FIELD_DEFINITIONS[entity];
  const valid: Array<{ row: number; data: T }> = [];
  const invalid: MappingIssue[] = [];
  const warnings: MappingIssue[] = [];
  const missingRequiredFields = defs
    .filter(def => def.required && !parsed.headers.some(header => mapping[header] === def.field))
    .map(def => def.field);

  const existingByField = new Map<string, Set<string>>();
  defs.filter(def => def.duplicate).forEach(def => {
    existingByField.set(def.field, new Set(
      existingRecords
        .map(record => normalizeKey(String(record[def.field as keyof ExistingImportRecord] || "")))
        .filter(Boolean)
    ));
  });

  const fileSeenByField = new Map<string, Set<string>>();
  defs.filter(def => def.duplicate).forEach(def => fileSeenByField.set(def.field, new Set()));

  parsed.sourceRows.forEach(sourceRow => {
    const rowIssues: MappingIssue[] = [];
    const values = new Map<string, { value: string; sourceColumn?: string }>();

    defs.forEach(def => {
      const valueInfo = getValue(sourceRow, parsed.headers, mapping, def.field);
      values.set(def.field, valueInfo);

      if (def.required && !valueInfo.value) {
        rowIssues.push({
          row: sourceRow.rowNumber,
          field: def.field,
          sourceColumn: valueInfo.sourceColumn,
          reason: valueInfo.sourceColumn
            ? `Missing required '${def.field}' in source column '${valueInfo.sourceColumn}'`
            : `Missing required '${def.field}' because no source column is mapped`,
        });
        return;
      }

      if (def.type === "email" && valueInfo.value && !isValidEmail(valueInfo.value)) {
        rowIssues.push({
          row: sourceRow.rowNumber,
          field: def.field,
          sourceColumn: valueInfo.sourceColumn,
          value: valueInfo.value,
          reason: `Invalid email '${valueInfo.value}' in source column '${valueInfo.sourceColumn || def.field}'`,
        });
      }

      if (def.type === "date" && valueInfo.value && !isValidDateValue(valueInfo.value)) {
        rowIssues.push({
          row: sourceRow.rowNumber,
          field: def.field,
          sourceColumn: valueInfo.sourceColumn,
          value: valueInfo.value,
          reason: `Invalid date '${valueInfo.value}' in source column '${valueInfo.sourceColumn || def.field}'`,
        });
      }

      if (def.type === "number" && valueInfo.value && Number.isNaN(toNumber(valueInfo.value))) {
        rowIssues.push({
          row: sourceRow.rowNumber,
          field: def.field,
          sourceColumn: valueInfo.sourceColumn,
          value: valueInfo.value,
          reason: `Invalid number '${valueInfo.value}' in source column '${valueInfo.sourceColumn || def.field}'`,
        });
      }
    });

    defs.filter(def => def.duplicate).forEach(def => {
      const valueInfo = values.get(def.field);
      const key = normalizeKey(valueInfo?.value || "");
      if (!key) return;

      const existing = existingByField.get(def.field);
      const fileSeen = fileSeenByField.get(def.field);
      if (existing?.has(key)) {
        pushDuplicateIssue(warnings, sourceRow.rowNumber, def.field, valueInfo?.sourceColumn, valueInfo!.value, "existing records");
      }
      if (fileSeen?.has(key)) {
        pushDuplicateIssue(rowIssues, sourceRow.rowNumber, def.field, valueInfo?.sourceColumn, valueInfo!.value, "file");
      }
      fileSeen?.add(key);
    });

    if (rowIssues.length > 0) {
      invalid.push(...rowIssues);
      return;
    }

    if (entity === "clients") {
      valid.push({
        row: sourceRow.rowNumber,
        data: {
          name: values.get("name")?.value || "",
          address: values.get("address")?.value || "",
          phone: values.get("phone")?.value || "",
          email: values.get("email")?.value || "",
          taxId: values.get("taxId")?.value || undefined,
        } as T,
      });
    } else if (entity === "suppliers") {
      valid.push({
        row: sourceRow.rowNumber,
        data: {
          name: values.get("name")?.value || "",
          address: values.get("address")?.value || "",
          phone: values.get("phone")?.value || "",
          email: values.get("email")?.value || "",
        } as T,
      });
    } else {
      const typeRaw = (values.get("type")?.value || "product").toLowerCase();
      const type = typeRaw === "service" ? "service" : typeRaw === "composed" ? "composed" : "product";
      valid.push({
        row: sourceRow.rowNumber,
        data: {
          name: values.get("name")?.value || "",
          description: values.get("description")?.value || undefined,
          type,
          salePrice: toNumber(values.get("salePrice")?.value || "0"),
          rawPrice: toNumber(values.get("rawPrice")?.value || "") || undefined,
          lowStockAlert: toNumber(values.get("lowStockAlert")?.value || "") || undefined,
          sku: values.get("sku")?.value || undefined,
          category: values.get("category")?.value || undefined,
          serviceCost: toNumber(values.get("serviceCost")?.value || "") || undefined,
        } as T,
      });
    }
  });

  return { valid, invalid, warnings, headers: parsed.headers, mapping, missingRequiredFields };
}

export function mapClients(rows: CsvRow[], headers: string[], mapping?: ColumnMapping, existingRecords?: ExistingImportRecord[]): MappingResult<MappedClient> {
  const parsed = createParsedFromRows(rows, headers);
  return mapImportRows<MappedClient>("clients", parsed, mapping, existingRecords);
}

export function mapSuppliers(rows: CsvRow[], headers: string[], mapping?: ColumnMapping, existingRecords?: ExistingImportRecord[]): MappingResult<MappedSupplier> {
  const parsed = createParsedFromRows(rows, headers);
  return mapImportRows<MappedSupplier>("suppliers", parsed, mapping, existingRecords);
}

export function mapProducts(rows: CsvRow[], headers: string[], mapping?: ColumnMapping, existingRecords?: ExistingImportRecord[]): MappingResult<MappedProduct> {
  const parsed = createParsedFromRows(rows, headers);
  return mapImportRows<MappedProduct>("products", parsed, mapping, existingRecords);
}

/** Sample CSV templates returned as downloadable text. */
export const SAMPLE_CSV: Record<ImportEntity, string> = {
  clients:
    "name,email,phone,address,taxId\n" +
    "Acme Corp,ops@acme.com,+961 1 234 567,Beirut Central,TAX-001\n" +
    "Globex,billing@globex.com,+961 3 987 654,Hamra Street,\n",
  suppliers:
    "name,email,phone,address\n" +
    "Initech,sales@initech.com,+961 1 555 010,Sin El Fil\n" +
    "Hooli,contact@hooli.com,+961 1 555 020,Achrafieh\n",
  products:
    "name,sku,type,salePrice,rawPrice,category,lowStockAlert,description\n" +
    "Espresso Beans 1kg,SKU-001,product,18,11,Coffee,5,Single origin Ethiopia\n" +
    "Consulting Hour,SKU-SVC,service,80,0,Services,,Hourly rate\n",
};

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
