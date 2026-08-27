import type { JournalEntry, JournalLine, LedgerAccount, LebaneseProfitLossForm, LebaneseProfitLossLine } from '@/types/generalLedger';
import { convertLedgerAmount, normalizeLedgerCurrency, type ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function accountHead(code: string): number {
  return parseInt(String(code).split('.')[0], 10);
}

function day(value: string): string {
  return String(value || '').slice(0, 10);
}

function netDebit(account: LedgerAccount, debit: number, credit: number): number {
  if (account.normalBalance === 'credit' || account.type === 'revenue' || account.type === 'liability' || account.type === 'equity') {
    return round2(credit - debit);
  }
  return round2(debit - credit);
}

function isInventoryAccount(account: LedgerAccount): boolean {
  if (!account.isActive) return false;
  const c = String(account.code || '').trim();
  if (['120', '121', '122', '123', '125'].includes(c)) return true;
  return /^(31|33|35|37)/.test(c);
}

function isPurchaseGoodsAccount(account: LedgerAccount): boolean {
  const c = String(account.code || '').trim();
  if (['502', '506'].includes(c)) return true;
  const head = accountHead(c);
  return Number.isFinite(head) && head >= 6010 && head < 6100;
}

function isCogsExpenseAccount(account: LedgerAccount): boolean {
  const c = String(account.code || '').trim();
  if (['501', '503', '505'].includes(c)) return true;
  const head = accountHead(c);
  return Number.isFinite(head) && head >= 6110 && head < 6220;
}

function isFxOther(account: LedgerAccount): boolean {
  const c = String(account.code || '').trim();
  if (['450', '704'].includes(c)) return true;
  const head = accountHead(c);
  return [6751, 7751, 766, 769, 668, 669].includes(head) || c === '6751' || c === '7751';
}

function isClass7(account: LedgerAccount): boolean {
  if (isFxOther(account)) return false;
  if (account.type === 'revenue') return true;
  const head = accountHead(account.code);
  const n = parseInt(account.code, 10);
  if (Number.isFinite(head) && head >= 7000 && head < 8000) return true;
  return Number.isFinite(n) && n >= 400 && n < 460;
}

function isOperatingSales(account: LedgerAccount): boolean {
  const c = String(account.code || '').trim();
  if (['401', '402', '403', '405', '410'].includes(c)) return true;
  const head = accountHead(c);
  return Number.isFinite(head) && head >= 7000 && head < 7200;
}

function isIncomeTax(account: LedgerAccount): boolean {
  const c = String(account.code || '').trim();
  const head = accountHead(c);
  return c === '695' || c === '6950' || head === 6950 || head === 6951;
}

type ExpenseBucket =
  | 'chargesGA'
  | 'salariesRelated'
  | 'taxes'
  | 'depreciationProvision'
  | 'bankInterest'
  | 'penalty'
  | 'skip';

function expenseBucket(account: LedgerAccount): ExpenseBucket {
  if (isPurchaseGoodsAccount(account) || isCogsExpenseAccount(account) || isFxOther(account) || isIncomeTax(account)) {
    return 'skip';
  }
  const c = String(account.code || '').trim();
  const head = accountHead(c);
  if (['601', '602'].includes(c) || (head >= 6310 && head < 6400) || (head >= 6350 && head < 6360)) return 'salariesRelated';
  if (c === '604' || c === '710' || (head >= 6800 && head < 6900) || (head >= 6370 && head < 6380)) return 'depreciationProvision';
  if (c === '701' || (head >= 6600 && head < 6700)) return 'bankInterest';
  if (head >= 6410 && head < 6500) return 'taxes';
  const name = `${account.name || ''} ${account.nameAr || ''}`.toLowerCase();
  if (/penalt|amende|غرامة|fine/.test(name) || (head >= 6710 && head < 6750)) return 'penalty';
  if (account.type === 'expense' || (head >= 6000 && head < 7000) || (parseInt(c, 10) >= 600 && parseInt(c, 10) < 800)) {
    return 'chargesGA';
  }
  return 'skip';
}

function periodPosted(entries: JournalEntry[], startDate: string, endDate: string): Set<string> {
  return new Set(
    entries.filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate)).map((e) => e.id),
  );
}

function sumAccounts(
  accounts: LedgerAccount[],
  lines: JournalLine[],
  postedIds: Set<string>,
  amountFn: (account: LedgerAccount, debit: number, credit: number) => number,
): { amount: number; accountIds: string[] } {
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!postedIds.has(line.entryId)) continue;
    const cur = byAccount.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + (line.debit || 0));
    cur.credit = round2(cur.credit + (line.credit || 0));
    byAccount.set(line.accountId, cur);
  }
  let amount = 0;
  const accountIds: string[] = [];
  for (const account of accounts) {
    const sums = byAccount.get(account.id);
    if (!sums) continue;
    const value = amountFn(account, sums.debit, sums.credit);
    if (!value) continue;
    amount = round2(amount + value);
    accountIds.push(account.id);
  }
  return { amount, accountIds };
}

function inventoryAsOf(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
  inclusive: boolean,
): { amount: number; accountIds: string[] } {
  const cutoff = day(asOfDate);
  const posted = new Set(
    entries
      .filter((e) => {
        if (e.status !== 'posted') return false;
        const d = day(e.date);
        return inclusive ? d <= cutoff : d < cutoff;
      })
      .map((e) => e.id),
  );
  let amount = 0;
  const accountIds: string[] = [];
  for (const account of accounts.filter(isInventoryAccount)) {
    let bal = round2(account.openingBalance || 0);
    for (const line of lines) {
      if (line.accountId !== account.id || !posted.has(line.entryId)) continue;
      bal = round2(bal + (line.debit || 0) - (line.credit || 0));
    }
    if (!bal) continue;
    amount = round2(amount + bal);
    accountIds.push(account.id);
  }
  return { amount, accountIds };
}

/** AM print: grouped thousands, 3 decimals, losses in parentheses. */
export function formatLebanesePlAmount(amount: number, decimals = 3): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(n));
  return n < 0 ? `(${text})` : text;
}

export function convertLebanesePlAmount(
  amount: number,
  storeCurrency: string,
  mode: ReportCurrencyMode,
  usdToLbp?: number,
): number {
  if (mode === 'both') return amount;
  const converted = convertLedgerAmount(amount, storeCurrency, mode, usdToLbp);
  return converted == null ? amount : converted;
}

export function lebanesePlColumnCurrency(storeCurrency: string, mode: ReportCurrencyMode): string {
  if (mode === 'both' || mode === 'LBP') return 'LBP';
  if (mode === 'USD') return 'USD';
  return normalizeLedgerCurrency(storeCurrency);
}

export function lebanesePlHasActivity(form: LebaneseProfitLossForm): boolean {
  return form.lines.some((line) => line.kind !== 'header' && line.amount !== 0);
}

export function buildLebaneseProfitLossForm(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
): LebaneseProfitLossForm {
  const start = day(startDate);
  const end = day(endDate);
  const postedPeriod = periodPosted(entries, start, end);
  const active = accounts.filter((a) => a.isActive && a.pcgKind !== 'G');

  const sales = sumAccounts(
    active.filter(isOperatingSales),
    lines,
    postedPeriod,
    (a, d, c) => netDebit(a, d, c),
  );
  const class7 = sumAccounts(
    active.filter(isClass7),
    lines,
    postedPeriod,
    (a, d, c) => netDebit(a, d, c),
  );
  const beginning = inventoryAsOf(active, entries, lines, start, false);
  const ending = inventoryAsOf(active, entries, lines, end, true);
  const purchases = sumAccounts(
    active.filter(isPurchaseGoodsAccount),
    lines,
    postedPeriod,
    (_a, d, c) => round2(d - c),
  );
  const cogsExpense = sumAccounts(
    active.filter(isCogsExpenseAccount),
    lines,
    postedPeriod,
    (_a, d, c) => round2(d - c),
  );

  let purchasesGoods = purchases.amount;
  let purchaseIds = purchases.accountIds;
  if (!purchasesGoods && (cogsExpense.amount || beginning.amount || ending.amount)) {
    purchasesGoods = round2(cogsExpense.amount + ending.amount - beginning.amount);
    purchaseIds = [...new Set([...purchases.accountIds, ...cogsExpense.accountIds])];
  }
  const totalCos = round2(beginning.amount + purchasesGoods - ending.amount);
  const totalClass7 = class7.amount || sales.amount;
  const grossProfit = round2(totalClass7 - totalCos);

  const buckets: Record<Exclude<ExpenseBucket, 'skip'>, { amount: number; accountIds: string[] }> = {
    chargesGA: { amount: 0, accountIds: [] },
    salariesRelated: { amount: 0, accountIds: [] },
    taxes: { amount: 0, accountIds: [] },
    depreciationProvision: { amount: 0, accountIds: [] },
    bankInterest: { amount: 0, accountIds: [] },
    penalty: { amount: 0, accountIds: [] },
  };
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!postedPeriod.has(line.entryId)) continue;
    const cur = byAccount.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + (line.debit || 0));
    cur.credit = round2(cur.credit + (line.credit || 0));
    byAccount.set(line.accountId, cur);
  }
  for (const account of active) {
    const bucket = expenseBucket(account);
    if (bucket === 'skip') continue;
    const sums = byAccount.get(account.id);
    if (!sums) continue;
    const value = round2(sums.debit - sums.credit);
    if (!value) continue;
    buckets[bucket].amount = round2(buckets[bucket].amount + value);
    buckets[bucket].accountIds.push(account.id);
  }

  const totalExpenses = round2(
    buckets.chargesGA.amount +
      buckets.salariesRelated.amount +
      buckets.taxes.amount +
      buckets.depreciationProvision.amount +
      buckets.bankInterest.amount +
      buckets.penalty.amount,
  );
  const profitBeforeTax = round2(grossProfit - totalExpenses);
  const others = sumAccounts(active.filter(isFxOther), lines, postedPeriod, (_a, d, c) => round2(c - d));
  const tax = sumAccounts(active.filter(isIncomeTax), lines, postedPeriod, (_a, d, c) => round2(d - c));
  const additions = 0;
  const taxableProfit = round2(profitBeforeTax + others.amount + additions);
  const netProfit = round2(taxableProfit - tax.amount);

  const line = (
    key: string,
    label: string,
    amount: number,
    kind: LebaneseProfitLossLine['kind'],
    extra?: Partial<LebaneseProfitLossLine>,
  ): LebaneseProfitLossLine => ({ key, label, amount, kind, ...extra });

  const linesOut: LebaneseProfitLossLine[] = [
    line('income', 'INCOME', 0, 'header'),
    line('sales', 'Sales', sales.amount || totalClass7, 'line', { accountIds: sales.accountIds.length ? sales.accountIds : class7.accountIds }),
    line('class7', 'Total Class 7', totalClass7, 'total', { underline: true, accountIds: class7.accountIds }),
    line('cos', 'C.O.S', 0, 'header'),
    line('bi', 'B.I', beginning.amount, 'line', { accountIds: beginning.accountIds }),
    line('purchases', 'Purchases Goods', purchasesGoods, 'line', { accountIds: purchaseIds }),
    line('ei', 'E.I', ending.amount, 'line', { underline: true, accountIds: ending.accountIds }),
    line('totalCos', 'Total COS', totalCos, 'total'),
    line('gross', 'Gross Profit', grossProfit, 'result'),
    line('expenses', 'EXPENSES', 0, 'header'),
    line('ga', 'Charges G & A', buckets.chargesGA.amount, 'line', { accountIds: buckets.chargesGA.accountIds }),
    line('salaries', 'Salaries & Related', buckets.salariesRelated.amount, 'line', { accountIds: buckets.salariesRelated.accountIds }),
    line('taxExp', 'Taxes', buckets.taxes.amount, 'line', { accountIds: buckets.taxes.accountIds }),
    line('depr', 'Depreciation+Employe Provision', buckets.depreciationProvision.amount, 'line', {
      accountIds: buckets.depreciationProvision.accountIds,
    }),
    line('interest', 'Bank Interest', buckets.bankInterest.amount, 'line', { accountIds: buckets.bankInterest.accountIds }),
    line('penalty', 'Penalty', buckets.penalty.amount, 'line', { underline: true, accountIds: buckets.penalty.accountIds }),
    line('totalExp', 'Total Expenses', totalExpenses, 'total'),
    line('pbt', 'Profit Before Tax', profitBeforeTax, 'result'),
    line('others', 'Others', others.amount, 'line', { accountIds: others.accountIds }),
    line('additions', 'Additions', additions, 'line', { underline: true }),
    line('taxable', 'Taxable Profit', taxableProfit, 'result'),
    line('tax', 'TAX', tax.amount, 'line', { accountIds: tax.accountIds }),
    line('net', 'NET PROFIT', netProfit, 'result'),
    line('beforeFx', 'Result Before Difference of Exchange', profitBeforeTax, 'result', { footer: true }),
    line('taxFx1', 'Tax', tax.amount, 'line', { footer: true }),
    line('afterFx', 'Result after Difference of Exchange Loss', taxableProfit, 'result', { footer: true }),
    line('taxFx2', 'Tax', tax.amount, 'line', { footer: true }),
  ];

  return {
    sales: sales.amount || totalClass7,
    totalClass7,
    beginningInventory: beginning.amount,
    purchasesGoods,
    endingInventory: ending.amount,
    totalCos,
    grossProfit,
    chargesGA: buckets.chargesGA.amount,
    salariesRelated: buckets.salariesRelated.amount,
    taxes: buckets.taxes.amount,
    depreciationProvision: buckets.depreciationProvision.amount,
    bankInterest: buckets.bankInterest.amount,
    penalty: buckets.penalty.amount,
    totalExpenses,
    profitBeforeTax,
    others: others.amount,
    additions,
    taxableProfit,
    tax: tax.amount,
    netProfit,
    resultBeforeExchange: profitBeforeTax,
    resultAfterExchange: taxableProfit,
    lines: linesOut,
  };
}
