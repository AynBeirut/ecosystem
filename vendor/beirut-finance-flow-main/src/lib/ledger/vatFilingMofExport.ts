import type { VatFilingSummaryReport } from '@/types/generalLedger';

type CompanyInfo = {
  name?: string;
  taxId?: string;
};

/** Lebanon MoF-style VAT worksheet (CSV) for accountant filing pack. */
export function vatFilingMofWorksheet(report: VatFilingSummaryReport, company: CompanyInfo): string {
  const rows: string[][] = [
    ['Lebanon VAT Worksheet (Grabio export)'],
    ['Taxpayer', company.name || ''],
    ['MOF / Tax ID', company.taxId || ''],
    ['Period from', report.startDate],
    ['Period to', report.endDate],
    ['Currency', report.currency],
    [],
    ['Line', 'Description', 'Amount'],
    ['1', 'Output VAT collected (220)', String(report.outputVat.net)],
    ['2', 'Input VAT recoverable (140)', String(report.inputVat.net)],
    ['3', 'Net VAT due (1 − 2)', String(report.netVatDue)],
    ['4', 'Settlement account balance (222)', String(report.settlement?.closingBalance ?? 0)],
    [],
    ['Output VAT detail'],
    ['Collected', String(report.outputVat.collected)],
    ['Reversed', String(report.outputVat.reversed)],
    ['Closing balance', String(report.outputVat.closingBalance)],
    [],
    ['Input VAT detail'],
    ['Recoverable', String(report.inputVat.recoverable)],
    ['Reversed', String(report.inputVat.reversed)],
    ['Closing balance', String(report.inputVat.closingBalance)],
    [],
    ['Status', report.netVatDueLabel === 'payable' ? 'Payable to MoF' : 'Recoverable credit'],
    ['Posted entries in period', String(report.entryCount)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
