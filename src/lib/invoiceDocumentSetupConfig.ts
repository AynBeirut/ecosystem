import type { FinanceInvoiceTemplate } from './invoiceTemplateMap';

export type DocumentLayoutId = 'classic-band' | 'accent-line' | 'minimal' | 'sidebar' | string;
export type DocumentLineWeight = 'fine' | 'regular' | 'bold';

export const DOCUMENT_LAYOUT_OPTIONS: {
  value: DocumentLayoutId;
  label: string;
  description: string;
}[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Logo, company block, titled band, item table, notes, grand total',
  },
  { value: 'classic-band', label: 'Classic band', description: 'Colored header block' },
  { value: 'accent-line', label: 'Accent line', description: 'White header with a thin color stripe' },
  { value: 'minimal', label: 'Minimal', description: 'High white space, light borders' },
  { value: 'sidebar', label: 'Sidebar', description: 'Vertical color bar on the left' },
];

export const LINE_WEIGHT_OPTIONS: { value: DocumentLineWeight; label: string }[] = [
  { value: 'fine', label: 'Fine lines' },
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold lines' },
];

export const LINE_STYLE_OPTIONS: { value: 'solid' | 'double' | 'dashed' | 'none'; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'double', label: 'Double' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'none', label: 'Open (no box)' },
];

export const COLOR_THEME_PRESETS: {
  id: string;
  label: string;
  primary: string;
  secondary: string;
}[] = [
  { id: 'orange', label: 'Orange', primary: '#E8752B', secondary: '#D9651F' },
  { id: 'goblin-teal', label: 'Goblin Teal', primary: '#3182CE', secondary: '#2B6CB0' },
  { id: 'ocean-blue', label: 'Ocean Blue', primary: '#2563EB', secondary: '#1D4ED8' },
  { id: 'forest', label: 'Forest', primary: '#059669', secondary: '#047857' },
  { id: 'slate', label: 'Slate', primary: '#475569', secondary: '#334155' },
  { id: 'violet', label: 'Violet', primary: '#7C3AED', secondary: '#6D28D9' },
];

export const TEMPLATE_STYLE_CARDS: {
  value: FinanceInvoiceTemplate;
  label: string;
  description: string;
  swatch: string;
}[] = [
  {
    value: 'modern',
    label: 'Modern',
    description: 'Clean teal header — best for most businesses',
    swatch: 'linear-gradient(135deg,#0f766e 0%,#14b8a6 100%)',
    primary: '#0f766e',
    secondary: '#115e59',
  },
  {
    value: 'basic',
    label: 'Classic',
    description: 'Black & gold — formal invoices',
    swatch: 'linear-gradient(135deg,#111827 0%,#ca8a04 100%)',
    primary: '#111827',
    secondary: '#ca8a04',
  },
  {
    value: 'professional',
    label: 'Vibrant',
    description: 'Purple & orange — bold branding',
    swatch: 'linear-gradient(135deg,#7c3aed 0%,#ea580c 100%)',
    primary: '#7c3aed',
    secondary: '#ea580c',
  },
];

export const PDF_LAYOUT_TEMPLATES: { id: number; label: string; hint: string }[] = [
  { id: 1, label: '1', hint: 'Header bar, title underneath' },
  { id: 2, label: '2', hint: 'Title between two rules' },
  { id: 3, label: '3', hint: 'Centered title, white header' },
  { id: 4, label: '4', hint: 'Title and number as pills' },
  { id: 5, label: '5', hint: 'Large title left, table filled' },
  { id: 6, label: '6', hint: 'Notes, bank, and totals in one row' },
  { id: 7, label: '7', hint: 'Company stacked under the logo' },
  { id: 8, label: '8', hint: 'Large title and number on the left' },
  { id: 9, label: '9', hint: 'Amount due under the title' },
  { id: 10, label: '10', hint: 'Title badge with number and date' },
];

export const FONT_SCALE_OPTIONS = ['xs', 's', 'm', 'l', 'xl', 'xxl'] as const;
export type HeaderAlign = 'left' | 'center' | 'right';

export const INVOICE_DUE_DAY_OPTIONS = [7, 14, 30, 45, 60, 90] as const;

/** Legacy web dropdown values → mobile layout ids */
export function normalizeDocumentLayout(raw?: string): DocumentLayoutId {
  if (!raw || raw === 'minimal' || raw === 'electro-service') return 'standard';
  if (raw === 'classic') return 'classic-band';
  if (raw === 'modern') return 'accent-line';
  return raw;
}

export function lineWeightToBorderPx(weight?: string): string {
  if (weight === 'fine') return '1px';
  if (weight === 'bold') return '3px';
  return '2px';
}
