import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import ReportCurrencyPicker from '@/components/ReportCurrencyPicker';
import type { IncomeStatementReport, LedgerAccount } from '@/types/generalLedger';
import type { ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';
import { convertLedgerAmount, formatLedgerAmount } from '@/lib/ledger/formatLedgerAmount';
import {
  convertLebanesePlAmount,
  formatLebanesePlAmount,
  lebanesePlColumnCurrency,
} from '@/lib/ledger/lebaneseProfitLoss';
import { formatSoaDate } from '@/lib/ledger/soaStatementView';
import { cn } from '@/lib/utils';

type Props = {
  report: IncomeStatementReport;
  storeCurrency: string;
  usdToLbp?: number;
  companyName?: string;
  hasActivity: boolean;
  systemGuideEnabled?: boolean;
  accounts?: LedgerAccount[];
  onExportCsv: () => void;
  onOpenAccount?: (accountId: string, label: string) => void;
};

export default function LebaneseProfitLossDocument({
  report,
  storeCurrency,
  usdToLbp,
  companyName,
  hasActivity,
  systemGuideEnabled,
  accounts = [],
  onExportCsv,
  onOpenAccount,
}: Props) {
  const [currencyMode, setCurrencyMode] = useState<ReportCurrencyMode>(
    storeCurrency.toUpperCase() === 'USD' ? 'USD' : 'LBP',
  );
  const form = report.lebaneseForm;
  const columnCcy = lebanesePlColumnCurrency(storeCurrency, currencyMode);
  const decimals = columnCcy === 'USD' ? 2 : 3;
  const body = form.lines.filter((l) => !l.footer);
  const footer = form.lines.filter((l) => l.footer);

  const display = (n: number) => {
    const converted = convertLebanesePlAmount(n, storeCurrency, currencyMode === 'both' ? 'LBP' : currencyMode, usdToLbp);
    return formatLebanesePlAmount(converted, currencyMode === 'USD' ? 2 : decimals);
  };

  const usdHint = (n: number) => {
    if (currencyMode !== 'both') return '';
    const usd = convertLedgerAmount(n, storeCurrency, 'USD', usdToLbp);
    if (usd == null) return '';
    return formatLedgerAmount(usd, 'USD');
  };

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle className="flex items-center gap-2">
          Profit &amp; Loss
          <SystemGuideInfo
            enabled={!!systemGuideEnabled}
            label="What P&L shows"
            title="Profit & Loss"
            content={[
              'Lebanese AM form: Income (Class 7), C.O.S (B.I + Purchases − E.I), expenses, then difference of exchange.',
              'Amounts are full digits. LBP uses 3 decimals; losses are in parentheses. Pick LBP / USD / both.',
            ]}
          />
        </CardTitle>
        <CardDescription>
          {report.startDate} → {report.endDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 print:hidden">
          <ReportCurrencyPicker value={currencyMode} onChange={setCurrencyMode} id="pl-currency" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              Print
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
              Export CSV
            </Button>
          </div>
        </div>

        {!hasActivity ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground print:hidden">
            No P&amp;L activity in {report.startDate} → {report.endDate}. Widen the date range or click Refresh if you just posted.
          </p>
        ) : null}

        <div className="pl-print mx-auto max-w-[42rem] bg-white text-[13px] text-slate-900">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2">
            <div>
              {companyName ? <p className="font-semibold uppercase tracking-wide">{companyName}</p> : null}
              <p className="text-base font-bold uppercase">Profit and Loss</p>
              <p>
                From : {formatSoaDate(report.startDate)} &nbsp; To : {formatSoaDate(report.endDate)}
              </p>
            </div>
            <p className="text-right font-semibold">{columnCcy}</p>
          </div>

          <table className="mt-3 w-full border-collapse">
            <tbody>
              {body.map((row) => {
                const clickable = onOpenAccount && row.accountIds?.length;
                const label = clickable ? (
                  <button
                    type="button"
                    className="text-left hover:underline print:no-underline"
                    onClick={() => {
                      const id = row.accountIds![0];
                      const account = accounts.find((a) => a.id === id);
                      onOpenAccount(id, account ? `${account.code} · ${account.name}` : row.label);
                    }}
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                );
                if (row.kind === 'header') {
                  return (
                    <tr key={row.key}>
                      <td className="pt-3 pb-1 font-bold uppercase tracking-wide" colSpan={2}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.key} className={cn(row.kind === 'result' && 'font-semibold', row.kind === 'total' && 'font-medium')}>
                    <td className={cn('py-0.5 pr-4', row.kind === 'result' && 'uppercase')}>{label}</td>
                    <td
                      className={cn(
                        'py-0.5 text-right tabular-nums',
                        row.underline && 'underline decoration-slate-800 underline-offset-4',
                        (row.kind === 'total' || row.kind === 'result') && 'border-t border-slate-800',
                      )}
                    >
                      {display(row.amount)}
                      {currencyMode === 'both' && usdHint(row.amount) ? (
                        <div className="text-[10px] font-normal text-slate-500 print:hidden">{usdHint(row.amount)}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-6 border-t-2 border-slate-800 pt-3">
            <table className="w-full border-collapse">
              <tbody>
                {footer.map((row) => (
                  <tr key={row.key} className={row.kind === 'result' ? 'font-semibold' : undefined}>
                    <td className="py-0.5 pr-4">{row.label}</td>
                    <td className="py-0.5 text-right tabular-nums">{display(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
