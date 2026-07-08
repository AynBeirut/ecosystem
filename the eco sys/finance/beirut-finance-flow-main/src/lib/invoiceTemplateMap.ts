export type FinanceInvoiceTemplate = 'basic' | 'modern' | 'professional';
export type GrabioInvoiceTemplate = 'modern' | 'classic' | 'vibrant';

/** Grabio Admin `invoiceTemplate` → Invoice Manager PDF/preview template. */
export function mapGrabioInvoiceTemplateToFinance(
  topLevel?: string | null,
  docLevel?: string | null,
): FinanceInvoiceTemplate {
  if (docLevel === 'basic' || docLevel === 'modern' || docLevel === 'professional') {
    return docLevel;
  }
  switch (topLevel) {
    case 'classic':
      return 'basic';
    case 'vibrant':
      return 'professional';
    case 'modern':
      return 'modern';
    default:
      return 'basic';
  }
}

export function mapFinanceInvoiceTemplateToGrabio(template: string): GrabioInvoiceTemplate {
  switch (template) {
    case 'basic':
      return 'classic';
    case 'professional':
      return 'vibrant';
    default:
      return 'modern';
  }
}
