import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';
import {
  PAYROLL_EXPENSE_GRABIO,
  PAYROLL_EXPENSE_PCG,
  PAYROLL_COMPONENT_LABEL,
  type PayrollComponentKind,
} from '@/lib/ledger/employeeSubaccountCodes';
import { ensureEmployeeComponentAccount } from '@/lib/ledger/employeeSubaccountLedger';
import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type PayrollPaymentInput = {
  id: string;
  staffId?: string;
  staffName?: string;
  paymentDate: string;
  paymentMethod?: string;
  baseAmount?: number;
  overtimeAmount?: number;
  commissionAmount?: number;
  bonusAmount?: number;
  transportAmount?: number;
  cnssAmount?: number;
  deductions?: number;
  totalAmount: number;
};

export type PayrollComponentLine = {
  kind: PayrollComponentKind;
  amount: number;
};

export function isPayrollExpenseLike(input: {
  category?: string;
  name?: string;
  description?: string;
  linkedStaffId?: string;
}): boolean {
  const cat = String(input.category || '').toLowerCase().trim();
  if (cat === 'payroll' || cat === 'staff_wages') return true;
  if (input.linkedStaffId) return true;
  const hay = `${input.name || ''} ${input.description || ''}`.toLowerCase();
  return /salary\s*payment|payroll|staff\s*wage|راتب/.test(hay);
}

export function splitPayrollComponents(input: PayrollPaymentInput): PayrollComponentLine[] {
  const deductions = round2(Number(input.deductions) || 0);
  const payBase = round2(
    (Number(input.baseAmount) || 0) + (Number(input.overtimeAmount) || 0) - deductions,
  );
  const rows: PayrollComponentLine[] = [];
  const push = (kind: PayrollComponentKind, amount: number) => {
    const value = round2(amount);
    if (value > 0) rows.push({ kind, amount: value });
  };

  push('pay', payBase);
  push('transport', Number(input.transportAmount) || 0);
  push('commission', Number(input.commissionAmount) || 0);
  push('bonus', Number(input.bonusAmount) || 0);
  push('cnss', Number(input.cnssAmount) || 0);

  const allocated = round2(rows.reduce((sum, row) => sum + row.amount, 0));
  const total = round2(Number(input.totalAmount) || 0);
  if (!rows.length && total > 0) {
    rows.push({ kind: 'pay', amount: total });
    return rows;
  }
  if (total > allocated) {
    rows.push({ kind: 'other', amount: round2(total - allocated) });
  } else if (total > 0 && allocated > total) {
    let excess = round2(allocated - total);
    for (let i = rows.length - 1; i >= 0 && excess > 0; i -= 1) {
      const cut = Math.min(rows[i].amount, excess);
      rows[i].amount = round2(rows[i].amount - cut);
      excess = round2(excess - cut);
      if (rows[i].amount <= 0) rows.splice(i, 1);
    }
  }
  return rows.filter((row) => row.amount > 0);
}

function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount | null {
  return accounts.find((account) => account.code === code && account.isActive !== false) || null;
}

function resolvePayrollExpenseAccount(
  accounts: LedgerAccount[],
  kind: PayrollComponentKind,
): LedgerAccount | null {
  const targetPcg = PAYROLL_EXPENSE_PCG[kind];
  const grabio = PAYROLL_EXPENSE_GRABIO[kind];

  const byGrabio = accountByCode(accounts, grabio);
  if (byGrabio) return byGrabio;

  const byMapped = accounts.find((account) => {
    const mapped = mapGrabioCodeToPcg(account.code);
    if (mapped === targetPcg) return true;
    const op = account.grabioOperationalCode ? mapGrabioCodeToPcg(account.grabioOperationalCode) : '';
    return op === targetPcg;
  });
  if (byMapped) return byMapped;

  const byPrefix = accounts.find((account) => {
    const code = String(account.code || '');
    return code.startsWith(targetPcg.replace('.', '')) && account.type === 'expense';
  });
  return byPrefix;
}

export async function buildPayrollJournalLines(
  storeId: string,
  input: PayrollPaymentInput,
  accounts: LedgerAccount[],
  cashAccountId: string,
): Promise<JournalLineInput[]> {
  const staffId = String(input.staffId || input.id || '').trim();
  const staffName = String(input.staffName || 'Employee').trim();
  const components = splitPayrollComponents(input);
  const lines: JournalLineInput[] = [];
  let total = 0;

  for (const row of components) {
    const expenseAcct = resolvePayrollExpenseAccount(accounts, row.kind);
    if (!expenseAcct) {
      throw new Error(`Missing payroll expense account for ${PAYROLL_COMPONENT_LABEL[row.kind]}`);
    }
    const employeeAcct = await ensureEmployeeComponentAccount(
      storeId,
      staffId,
      staffName,
      row.kind,
      accounts,
    );
    if (!employeeAcct) {
      throw new Error(`Could not create employee account for ${staffName} (${row.kind})`);
    }
    const label = PAYROLL_COMPONENT_LABEL[row.kind];
    lines.push({
      accountId: expenseAcct.id,
      debit: row.amount,
      credit: 0,
      description: `${label} — ${staffName}`,
    });
    lines.push({
      accountId: employeeAcct.id,
      debit: 0,
      credit: row.amount,
      description: `${staffName} — ${label}`,
    });
    lines.push({
      accountId: employeeAcct.id,
      debit: row.amount,
      credit: 0,
      description: `${staffName} — ${label} paid`,
    });
    total = round2(total + row.amount);
  }

  if (total <= 0) return [];
  lines.push({
    accountId: cashAccountId,
    debit: 0,
    credit: total,
    description: `Payroll — ${staffName}`,
  });

  return lines;
}

export function formatPayrollJournalMemo(input: PayrollPaymentInput): string {
  const name = String(input.staffName || '').trim();
  const id = String(input.id || '').trim();
  if (name && id) return `Payroll — ${name}`;
  if (name) return `Payroll — ${name}`;
  return 'Payroll payment';
}

export function payrollVoucherMeta(input: PayrollPaymentInput): Record<string, string> | undefined {
  const staffId = String(input.staffId || '').trim();
  const staffName = String(input.staffName || '').trim();
  if (!staffId && !staffName) return undefined;
  return {
    ...(staffId ? { staffId, employeeId: staffId } : {}),
    ...(staffName ? { staffName, partyName: staffName } : {}),
  };
}

export function cashOrBank(paymentMethod?: string): string {
  const pm = String(paymentMethod || 'cash').toLowerCase();
  if (pm === 'bank' || pm === 'transfer' || pm === 'card') return GL_ACCOUNT_CODES.BANK;
  return GL_ACCOUNT_CODES.CASH;
}
