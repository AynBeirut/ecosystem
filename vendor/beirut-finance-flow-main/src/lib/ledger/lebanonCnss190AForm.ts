import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { parseMofAmountInput } from '@/lib/ledger/lebanonVatReturnForm';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type CnssPaymentMethod = 0 | 1 | 2 | 3;

export type CnssBranchKey = 'sickness' | 'eos' | 'family';

export type CnssBranchRow = {
  key: CnssBranchKey;
  labelAr: string;
  refCode: string;
  ratePercent: number;
  employeeCount: number;
  wages: number;
  contributionsDue: number;
  contributionPaid: number;
  contributionPaidCode: string;
  delayDays: number;
  delayDue: number;
  delayPaid: number;
  delayPaidCode: string;
};

export type LebanonCnss190AForm = {
  startDate: string;
  endDate: string;
  currency: string;
  companyName: string;
  companyNumber: string;
  documentNumber: string;
  declarationDay: string;
  declarationMonth: string;
  declarationYear: string;
  paymentMethod: CnssPaymentMethod;
  periodLabel: string;
  yearLabel: string;
  notes: string;
  branches: CnssBranchRow[];
  totalContributionsDue: number;
  familyAllowancesPaid: number;
  balanceDueToFund: number;
  totalAmountsPaid: number;
};

export const CNSS_BRANCH_DEFS: Array<Pick<CnssBranchRow, 'key' | 'labelAr' | 'refCode' | 'ratePercent'>> = [
  { key: 'sickness', labelAr: 'المرض والأمومة', refCode: '3/0/1/0/', ratePercent: 9 },
  { key: 'eos', labelAr: 'تعويض نهاية الخدمة', refCode: '1/0/1/0/', ratePercent: 8.5 },
  { key: 'family', labelAr: 'التعويضات العائلية', refCode: '2/0/1/0/', ratePercent: 6 },
];

const WAGE_CODES = ['631', '6310', '6311', '6312', '6313', '6314', '6316', '6317'];
const CNSS_EXPENSE_CODES = ['602', '6021', '6351'];
const CNSS_PAYABLE_CODES = ['212', '2121', '4311'];

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
  side: 'expenseDebit' | 'payableCredit',
): number {
  const posted = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate))
      .map((e) => e.id),
  );
  const accountIds = new Set(
    accounts.filter((a) => a.isActive && matchesCode(a.code, codePrefixes)).map((a) => a.id),
  );
  let total = 0;
  for (const line of lines) {
    if (!posted.has(line.entryId) || !accountIds.has(line.accountId)) continue;
    if (side === 'expenseDebit') total += round2((line.debit || 0) - (line.credit || 0));
    else total += round2((line.credit || 0) - (line.debit || 0));
  }
  return round2(Math.max(0, total));
}

function branchRow(
  def: (typeof CNSS_BRANCH_DEFS)[number],
  wages: number,
  employeeCount: number,
  contributionPaid = 0,
): CnssBranchRow {
  const contributionsDue = round2((wages * def.ratePercent) / 100);
  return {
    ...def,
    employeeCount,
    wages: round2(wages),
    contributionsDue,
    contributionPaid: round2(contributionPaid),
    contributionPaidCode: '/ / /0/1/',
    delayDays: 0,
    delayDue: 0,
    delayPaid: 0,
    delayPaidCode: '/ / /0/7/',
  };
}

function recalcBranch(row: CnssBranchRow): CnssBranchRow {
  const contributionsDue = round2((row.wages * row.ratePercent) / 100);
  const delayDue = round2((contributionsDue * row.delayDays) / 2000);
  return { ...row, contributionsDue, delayDue };
}

export function recalculateLebanonCnss190AForm(form: LebanonCnss190AForm): LebanonCnss190AForm {
  const branches = form.branches.map(recalcBranch);
  const totalContributionsDue = round2(
    branches.reduce((s, b) => s + b.contributionsDue + b.delayDue, 0),
  );
  const totalAmountsPaid = round2(
    branches.reduce((s, b) => s + b.contributionPaid + b.delayPaid, 0),
  );
  const balanceDueToFund = round2(
    totalContributionsDue - form.familyAllowancesPaid - totalAmountsPaid,
  );
  return {
    ...form,
    branches,
    totalContributionsDue,
    totalAmountsPaid,
    balanceDueToFund,
  };
}

export function buildLebanonCnss190AFormFromGl(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
  currency = 'LBP',
): LebanonCnss190AForm {
  const wages = periodAmountForCodes(accounts, entries, lines, startDate, endDate, WAGE_CODES, 'expenseDebit');
  const employerExpense = periodAmountForCodes(
    accounts,
    entries,
    lines,
    startDate,
    endDate,
    CNSS_EXPENSE_CODES,
    'expenseDebit',
  );
  const payable = periodAmountForCodes(
    accounts,
    entries,
    lines,
    startDate,
    endDate,
    CNSS_PAYABLE_CODES,
    'payableCredit',
  );

  const employeeCount = wages > 0 ? 1 : 0;
  const end = endDate.slice(0, 10);
  const [yearLabel, monthLabel] = [end.slice(0, 4), end.slice(5, 7)];

  const branches = CNSS_BRANCH_DEFS.map((def) => {
    const due = round2((wages * def.ratePercent) / 100);
    const paidShare =
      employerExpense > 0
        ? round2((due / Math.max(1, CNSS_BRANCH_DEFS.reduce((s, d) => s + (wages * d.ratePercent) / 100, 0))) * payable)
        : 0;
    return branchRow(def, wages, employeeCount, paidShare);
  });

  const base: LebanonCnss190AForm = {
    startDate,
    endDate,
    currency,
    companyName: '',
    companyNumber: '',
    documentNumber: '',
    declarationDay: end.slice(8, 10),
    declarationMonth: monthLabel,
    declarationYear: yearLabel,
    paymentMethod: payable > 0 ? 2 : 0,
    periodLabel: `${monthLabel}/${yearLabel}`,
    yearLabel,
    notes: employerExpense > 0 ? `GL employer CNSS expense: ${employerExpense}` : '',
    branches,
    totalContributionsDue: 0,
    familyAllowancesPaid: 0,
    balanceDueToFund: 0,
    totalAmountsPaid: 0,
  };

  return recalculateLebanonCnss190AForm(base);
}

export function updateCnssBranchField(
  form: LebanonCnss190AForm,
  key: CnssBranchKey,
  field: keyof Pick<
    CnssBranchRow,
    | 'employeeCount'
    | 'wages'
    | 'contributionPaid'
    | 'contributionPaidCode'
    | 'delayDays'
    | 'delayPaid'
    | 'delayPaidCode'
  >,
  value: number | string,
): LebanonCnss190AForm {
  return {
    ...form,
    branches: form.branches.map((row) =>
      row.key === key
        ? {
            ...row,
            [field]:
              typeof value === 'number'
                ? field === 'employeeCount' || field === 'delayDays'
                  ? Math.max(0, Math.round(value))
                  : round2(value)
                : String(value),
          }
        : row,
    ),
  };
}

export function updateCnssFormMeta(
  form: LebanonCnss190AForm,
  patch: Partial<
    Pick<
      LebanonCnss190AForm,
      | 'companyName'
      | 'companyNumber'
      | 'documentNumber'
      | 'declarationDay'
      | 'declarationMonth'
      | 'declarationYear'
      | 'paymentMethod'
      | 'periodLabel'
      | 'yearLabel'
      | 'notes'
      | 'familyAllowancesPaid'
    >
  >,
): LebanonCnss190AForm {
  return { ...form, ...patch };
}

export { parseMofAmountInput };

export function lebanonCnss190AFormToCsv(form: LebanonCnss190AForm): string {
  const rows: string[][] = [
    ['CNSS 190A', `${form.startDate} to ${form.endDate}`],
    ['Company', form.companyName],
    ['Number', form.companyNumber],
    [],
    ['Branch', 'Employees', 'Wages', 'Rate%', 'Due', 'Paid', 'DelayDue', 'DelayPaid'],
    ...form.branches.map((b) => [
      b.labelAr,
      String(b.employeeCount),
      String(b.wages),
      String(b.ratePercent),
      String(b.contributionsDue),
      String(b.contributionPaid),
      String(b.delayDue),
      String(b.delayPaid),
    ]),
    [],
    ['Total due', String(form.totalContributionsDue)],
    ['Family paid', String(form.familyAllowancesPaid)],
    ['Balance due', String(form.balanceDueToFund)],
    ['Total paid', String(form.totalAmountsPaid)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
