import type { AccountRangeStatementReport, AccountRangeStatementSection, LedgerAccount } from '@/types/generalLedger';
import { normalizeLedgerCurrency, type ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';
import {
  convertSoaAmount,
  formatSoaBalance,
  formatSoaDate,
  formatSoaPlainAmount,
  sayAccountCurrency,
  soaCurrencyCaption,
  soaDisplayCurrency,
  soaLineDescription,
  soaSectionTotals,
} from '@/lib/ledger/soaStatementView';
import { cn } from '@/lib/utils';

type Props = {
  report: AccountRangeStatementReport;
  section: AccountRangeStatementSection;
  account?: LedgerAccount;
  accountName: string;
  storeCurrency: string;
  currencyMode: ReportCurrencyMode;
  usdToLbp?: number;
  companyName?: string;
  onOpenEntry?: (entryId: string) => void;
  compact?: boolean;
};

export default function SoaAccountDocument({
  report,
  section,
  account,
  accountName,
  storeCurrency,
  currencyMode,
  usdToLbp,
  companyName,
  onOpenEntry,
  compact,
}: Props) {
  const displayCcy = soaDisplayCurrency(storeCurrency, currencyMode, account?.currency);
  const convert = (n: number) => convertSoaAmount(n, storeCurrency, currencyMode, usdToLbp);
  const num = (n: number) => formatSoaPlainAmount(convert(n), displayCcy);
  const cell = (n: number) => (n ? num(n) : '');
  const bal = (n: number) => formatSoaBalance(convert(n), displayCcy);
  const totals = soaSectionTotals(section);
  const nativeCcy = normalizeLedgerCurrency(account?.currency || storeCurrency);
  const caption = currencyMode === 'both' || displayCcy !== nativeCcy
    ? soaCurrencyCaption(currencyMode)
    : 'In Account Currency';

  return (
    <div className={cn('soa-print bg-white text-slate-900', compact ? 'text-[11px]' : 'text-[12px]')}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2">
        <div className="space-y-0.5">
          {companyName ? <p className="font-semibold uppercase tracking-wide">{companyName}</p> : null}
          <p>
            <span className="font-semibold">Code:</span> <span className="font-mono">{section.accountCode}</span>
          </p>
          <p>
            <span className="font-semibold">Name:</span> {accountName}
          </p>
          <p>
            <span className="font-semibold">Currency:</span> {displayCcy}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold uppercase tracking-wide">Statement Of Account</p>
          <p className="font-mono font-semibold">{section.accountCode}</p>
          <p className="text-[11px] italic">{caption}</p>
          <p className="mt-1">
            From : {formatSoaDate(report.startDate)} &nbsp; To : {formatSoaDate(report.endDate)}
          </p>
        </div>
      </div>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-800">
            <th className="py-1.5 text-left font-semibold">Date</th>
            <th className="py-1.5 text-left font-semibold">Description</th>
            <th className="py-1.5 text-right font-semibold">Debit</th>
            <th className="py-1.5 text-right font-semibold">Credit</th>
            <th className="py-1.5 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="whitespace-nowrap py-1 pr-2">{formatSoaDate(report.startDate)}</td>
            <td className="py-1 pr-2 font-semibold">B/F</td>
            <td className="py-1 text-right tabular-nums">{cell(section.openingDebit)}</td>
            <td className="py-1 text-right tabular-nums">{cell(section.openingCredit)}</td>
            <td className="py-1 text-right tabular-nums font-medium">{bal(section.openingBalance)}</td>
          </tr>
          {section.rows.map((row, idx) => {
            const desc = soaLineDescription(row);
            return (
              <tr key={`${row.entryId}-${idx}`} className="border-b border-slate-200">
                <td className="whitespace-nowrap py-1 pr-2">{formatSoaDate(row.date)}</td>
                <td className="py-1 pr-2">
                  {onOpenEntry && row.entryId ? (
                    <button
                      type="button"
                      className="text-left text-sky-800 underline decoration-sky-300 underline-offset-2 hover:text-sky-950 print:text-inherit print:no-underline"
                      onClick={() => onOpenEntry(row.entryId)}
                    >
                      {desc.text}
                    </button>
                  ) : (
                    desc.text
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{cell(row.debit)}</td>
                <td className="py-1 text-right tabular-nums">{cell(row.credit)}</td>
                <td className="py-1 text-right tabular-nums">{bal(row.runningBalance)}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-800 font-semibold">
            <td className="py-2" colSpan={2}>
              Total
            </td>
            <td className="py-2 text-right tabular-nums">{num(totals.totalDebit)}</td>
            <td className="py-2 text-right tabular-nums">{num(totals.totalCredit)}</td>
            <td className="py-2 text-right tabular-nums">{bal(section.closingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 italic">
        {sayAccountCurrency(convert(section.closingBalance))}
      </p>
    </div>
  );
}
