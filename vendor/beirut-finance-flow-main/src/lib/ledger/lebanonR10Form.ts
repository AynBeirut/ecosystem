import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { parseMofAmountInput } from '@/lib/ledger/lebanonVatReturnForm';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type R10FormCell = number | 'na';

export type R10DualRow = {
  code: number;
  labelAr: string;
  board: R10FormCell;
  employees: R10FormCell;
  isTotal?: boolean;
};

export type R10SingleRow = {
  code: number;
  labelAr: string;
  amount: R10FormCell;
  isTotal?: boolean;
  section?: 'flat' | 'totals';
};

export type R10HeaderCount = {
  code: 70 | 80 | 90;
  labelAr: string;
  value: number;
};

export type LebanonR10Form = {
  startDate: string;
  endDate: string;
  currency: string;
  headerCounts: R10HeaderCount[];
  chapterTwo: R10DualRow[];
  flatWages: R10SingleRow[];
  totals: R10SingleRow[];
};

export const COMPUTED_R10_DUAL_CODES = new Set([120, 160, 180]);
export const COMPUTED_R10_SINGLE_CODES = new Set([260, 270, 300]);

const WAGE_CODES = ['631', '6310', '6311', '6312', '6313', '6314', '6316', '6317'];
const WITHHOLDING_CODES = ['213', '431', '4311', '4410'];

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function accountHead(code: string): string {
  return String(code).split('.')[0];
}

function matchesCode(code: string, prefixes: string[]): boolean {
  const head = accountHead(code);
  return prefixes.some((p) => head === p || head.startsWith(p));
}

function periodAmountForCodes(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
  codePrefixes: string[],
  side: 'expenseDebit' | 'withholdingCredit',
): number {
  const posted = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate))
      .map((e) => e.id),
  );
  const accountIds = new Set(
    accounts
      .filter((a) => a.isActive && matchesCode(a.code, codePrefixes))
      .map((a) => a.id),
  );
  let total = 0;
  for (const line of lines) {
    if (!posted.has(line.entryId) || !accountIds.has(line.accountId)) continue;
    if (side === 'expenseDebit') total += round2((line.debit || 0) - (line.credit || 0));
    else total += round2((line.credit || 0) - (line.debit || 0));
  }
  return round2(Math.max(0, total));
}

function num(cell: R10FormCell): number {
  return typeof cell === 'number' ? cell : 0;
}

function dualRow(code: number, labelAr: string, board: number, employees: number, isTotal?: boolean): R10DualRow {
  return { code, labelAr, board: round2(board), employees: round2(employees), isTotal };
}

function singleRow(
  code: number,
  labelAr: string,
  amount: number,
  opts?: { isTotal?: boolean; section?: 'flat' | 'totals' },
): R10SingleRow {
  return { code, labelAr, amount: round2(amount), ...opts };
}

export function recalculateLebanonR10Form(form: LebanonR10Form): LebanonR10Form {
  const byCode = new Map(form.chapterTwo.map((r) => [r.code, r]));
  const get = (code: number) => byCode.get(code) || dualRow(code, '', 0, 0);

  const r100 = get(100);
  const r110 = get(110);
  const r120 = dualRow(
    120,
    'مجموع المبالغ المدفوعة',
    num(r100.board) + num(r110.board),
    num(r100.employees) + num(r110.employees),
    true,
  );
  const r130 = get(130);
  const r140 = get(140);
  const r150 = get(150);
  const r160 = dualRow(
    160,
    'المبالغ الصافية',
    num(r120.board) - num(r130.board) - num(r140.board) - num(r150.board),
    num(r120.employees) - num(r130.employees) - num(r140.employees) - num(r150.employees),
    true,
  );
  const r170 = get(170);
  const r180 = dualRow(
    180,
    'الرواتب والأجور الخاضعة للضريبة',
    num(r160.board) - num(r170.board),
    num(r160.employees) - num(r170.employees),
    true,
  );
  const r190 = get(190);

  const chapterTwo: R10DualRow[] = [
    r100,
    r110,
    r120,
    r130,
    r140,
    r150,
    r160,
    r170,
    r180,
    r190,
  ];

  const flatByCode = new Map(form.flatWages.map((r) => [r.code, r]));
  const r240 = flatByCode.get(240) || singleRow(240, 'المبالغ المدفوعة كأجور مقطوعة', 0, { section: 'flat' });
  const r250 = flatByCode.get(250) || singleRow(250, 'الضريبة على الأجور المقطوعة', 0, { section: 'flat' });

  const totalsByCode = new Map(form.totals.map((r) => [r.code, r]));
  const r260 = singleRow(
    260,
    'إجمالي الرواتب والأجور الخاضعة للضريبة',
    num(r180.board) + num(r180.employees),
    { isTotal: true, section: 'totals' },
  );
  const r270 = singleRow(
    270,
    'إجمالي الضريبة المتوجبة',
    num(r190.board) + num(r190.employees) + num(r250.amount),
    { isTotal: true, section: 'totals' },
  );
  const r280 = totalsByCode.get(280) || singleRow(280, 'غرامة التحقق', 0, { section: 'totals' });
  const r290 = totalsByCode.get(290) || singleRow(290, 'غرامة التحصيل', 0, { section: 'totals' });
  const r300 = singleRow(
    300,
    'المبلغ الإجمالي الواجب دفعه',
    num(r270.amount) + num(r280.amount) + num(r290.amount),
    { isTotal: true, section: 'totals' },
  );

  return {
    ...form,
    chapterTwo,
    flatWages: [r240, r250],
    totals: [r260, r270, r280, r290, r300],
  };
}

export function buildLebanonR10FormFromGl(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
  currency = 'LBP',
): LebanonR10Form {
  const wages = periodAmountForCodes(accounts, entries, lines, startDate, endDate, WAGE_CODES, 'expenseDebit');
  const withholding = periodAmountForCodes(
    accounts,
    entries,
    lines,
    startDate,
    endDate,
    WITHHOLDING_CODES,
    'withholdingCredit',
  );

  const base: LebanonR10Form = {
    startDate,
    endDate,
    currency,
    headerCounts: [
      { code: 70, labelAr: 'عدد رئيس وأعضاء مجلس الإدارة', value: 0 },
      { code: 80, labelAr: 'عدد المستخدمين والأجراء للفترة المصرح عنها', value: wages > 0 ? 1 : 0 },
      { code: 90, labelAr: 'عدد العمال الذين يتقاضون أجوراً مقطوعة', value: 0 },
    ],
    chapterTwo: [
      dualRow(100, 'الرواتب وملحقاتها', 0, wages),
      dualRow(110, 'المنافع النقدية والعينية', 0, 0),
      dualRow(120, 'مجموع المبالغ المدفوعة', 0, 0, true),
      dualRow(130, 'ينزل: تعويضات نقل وانتقال', 0, 0),
      dualRow(140, 'تعويضات تمثيل', 0, 0),
      dualRow(150, 'تنزيلات أخرى', 0, 0),
      dualRow(160, 'المبالغ الصافية', 0, 0, true),
      dualRow(170, 'التنزيل العائلي', 0, 0),
      dualRow(180, 'الرواتب والأجور الخاضعة للضريبة', 0, 0, true),
      dualRow(190, 'الضريبة المتوجبة', 0, withholding),
    ],
    flatWages: [
      singleRow(240, 'المبالغ المدفوعة كأجور مقطوعة', 0, { section: 'flat' }),
      singleRow(250, 'الضريبة على الأجور المقطوعة', 0, { section: 'flat' }),
    ],
    totals: [
      singleRow(260, 'إجمالي الرواتب والأجور الخاضعة للضريبة', 0, { isTotal: true, section: 'totals' }),
      singleRow(270, 'إجمالي الضريبة المتوجبة', 0, { isTotal: true, section: 'totals' }),
      singleRow(280, 'غرامة التحقق', 0, { section: 'totals' }),
      singleRow(290, 'غرامة التحصيل', 0, { section: 'totals' }),
      singleRow(300, 'المبلغ الإجمالي الواجب دفعه', 0, { isTotal: true, section: 'totals' }),
    ],
  };

  return recalculateLebanonR10Form(base);
}

export function updateR10DualCell(
  form: LebanonR10Form,
  code: number,
  col: 'board' | 'employees',
  value: number,
): LebanonR10Form {
  if (COMPUTED_R10_DUAL_CODES.has(code)) return form;
  return {
    ...form,
    chapterTwo: form.chapterTwo.map((row) =>
      row.code === code ? { ...row, [col]: round2(value) } : row,
    ),
  };
}

export function updateR10SingleCell(form: LebanonR10Form, code: number, value: number): LebanonR10Form {
  if (COMPUTED_R10_SINGLE_CODES.has(code)) return form;
  if (code === 240 || code === 250) {
    return {
      ...form,
      flatWages: form.flatWages.map((row) => (row.code === code ? { ...row, amount: round2(value) } : row)),
    };
  }
  return {
    ...form,
    totals: form.totals.map((row) => (row.code === code ? { ...row, amount: round2(value) } : row)),
  };
}

export function updateR10HeaderCount(form: LebanonR10Form, code: 70 | 80 | 90, value: number): LebanonR10Form {
  return {
    ...form,
    headerCounts: form.headerCounts.map((row) => (row.code === code ? { ...row, value: Math.max(0, Math.round(value)) } : row)),
  };
}

export { parseMofAmountInput };

export function lebanonR10FormToCsv(form: LebanonR10Form): string {
  const rows: string[][] = [
    ['Lebanon R10', `${form.startDate} to ${form.endDate}`],
    [],
    ['Header', 'Code', 'Value'],
    ...form.headerCounts.map((r) => ['', String(r.code), String(r.value)]),
    [],
    ['Chapter II', 'Code', 'Board', 'Employees'],
    ...form.chapterTwo.map((r) => [r.labelAr, String(r.code), String(r.board), String(r.employees)]),
    [],
    ['Flat wages', 'Code', 'Amount'],
    ...form.flatWages.map((r) => [r.labelAr, String(r.code), String(r.amount)]),
    [],
    ['Totals', 'Code', 'Amount'],
    ...form.totals.map((r) => [r.labelAr, String(r.code), String(r.amount)]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
