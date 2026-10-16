export type DocumentLayoutStyle = 'classic' | 'accent-line' | 'minimal' | 'sidebar';
export type DocumentLineWeight = 'fine' | 'regular' | 'bold';

export const LAYOUT_OPTIONS: {
  value: DocumentLayoutStyle;
  label: string;
  desc: string;
}[] = [
  { value: 'classic', label: 'Classic band', desc: 'Colored header block — bold & professional' },
  { value: 'accent-line', label: 'Accent line', desc: 'Clean white header with color stripe' },
  { value: 'minimal', label: 'Minimal', desc: 'Lots of whitespace, light borders' },
  { value: 'sidebar', label: 'Sidebar', desc: 'Vertical color bar on the left' },
];

export const LINE_WEIGHT_OPTIONS: {
  value: DocumentLineWeight;
  label: string;
  desc: string;
}[] = [
  { value: 'fine', label: 'Fine lines', desc: 'Thin borders & lighter type' },
  { value: 'regular', label: 'Regular', desc: 'Balanced — default' },
  { value: 'bold', label: 'Bold lines', desc: 'Thick borders & heavy headings' },
];

export const SAMPLE_PREVIEW_INVOICE = {
  invoiceNumber: 'INV-1024',
  clientName: 'Sample Client Ltd',
  date: new Date().toISOString(),
  status: 'unpaid',
  currency: 'USD',
  items: [
    { id: '1', description: 'Consulting services', quantity: 2, unitPrice: 150, subtotal: 300 },
    { id: '2', description: 'Support package', quantity: 1, unitPrice: 120, subtotal: 120 },
  ],
  tax: 11,
  notes: 'Thank you for your business.',
};

export function normalizeDocumentLayout(value?: string | null): DocumentLayoutStyle {
  if (value === 'accent-line' || value === 'minimal' || value === 'sidebar' || value === 'classic') {
    return value;
  }
  return 'classic';
}

export function normalizeDocumentLineWeight(value?: string | null): DocumentLineWeight {
  if (value === 'fine' || value === 'bold' || value === 'regular') return value;
  return 'regular';
}
