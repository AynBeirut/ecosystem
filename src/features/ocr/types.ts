export type OcrLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OcrSuggestedDestination = 'purchase' | 'expense' | 'ambiguous';

export type OcrDraft = {
  rawText: string;
  vendorName: string;
  date: string;
  currency: string;
  total: number;
  lineItems: OcrLineItem[];
  suggestedDestination: OcrSuggestedDestination;
  suggestionReason: string;
};

export type OcrDestination = 'purchase' | 'expense';

export type OcrConfirmDraft = OcrDraft & {
  destination: OcrDestination;
  /** Purchase: selected supplier id */
  supplierId?: string;
  /** Purchase: material id per line index (empty = unmatched) */
  materialIds?: string[];
  /** Expense category */
  expenseCategory?: string;
};
