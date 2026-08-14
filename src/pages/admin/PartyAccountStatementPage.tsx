import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/context/useAuth';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { Button } from '@/components/ui/button';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import { getActualStoreId } from '@/lib/storeUtils';
import { initArabicPDF, writeText } from '@/lib/arabicPDF';
import {
  buildPartyOperationalStatement,
  loadStoreCompanyProfile,
  type PartyStatementReport,
  type PartyType,
  type StoreCompanyProfile,
} from '@/lib/partyOperationalStatement';
import { cn } from '@/lib/utils';

function formatAmount(value: number, money: (amount: number) => string): string {
  if (!value) return '—';
  if (value < 0) return `(${money(Math.abs(value))})`;
  return money(value);
}

function exportStatementPdf(
  report: PartyStatementReport,
  company: StoreCompanyProfile,
  money: (amount: number) => string,
) {
  const doc = new jsPDF();
  void initArabicPDF(doc).then(() => {
    let y = 18;
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 120);
    doc.text(company.name.substring(0, 40), 14, y);
    y += 8;
    doc.setFontSize(18);
    doc.text('Statement', 150, 14);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${report.statementDate}`, 150, 22);
    doc.text(`Statement #: ${report.statementNumber}`, 150, 28);
    doc.text(`${report.partyType === 'customer' ? 'Customer' : 'Supplier'} ID: ${report.billTo.accountCode || report.partyId.slice(0, 8)}`, 150, 34);

    y = 42;
    doc.setFillColor(30, 64, 120);
    doc.rect(14, y, 88, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Bill To:', 16, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;
    writeText(doc, report.billTo.name, 16, y);
    y += 5;
    if (report.billTo.address) {
      writeText(doc, report.billTo.address, 16, y);
      y += 5;
    }
    if (report.billTo.phone) {
      doc.text(`Phone: ${report.billTo.phone}`, 16, y);
      y += 5;
    }

    const summaryX = 110;
    let sy = 42;
    doc.setFillColor(30, 64, 120);
    doc.rect(summaryX, sy, 86, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Account Summary', summaryX + 2, sy + 5);
    doc.setTextColor(0, 0, 0);
    sy += 12;
    const summaryRows = [
      ['Previous Balance', formatAmount(report.openingBalance, money)],
      ['Credits', formatAmount(report.totalCredits, money)],
      ['New Charges', formatAmount(report.totalCharges, money)],
      ['Total Balance Due', formatAmount(report.closingBalance, money)],
      ['Payment Due Date', report.paymentDueDate],
    ];
    summaryRows.forEach(([label, value]) => {
      doc.text(label, summaryX + 2, sy);
      doc.text(String(value), 194, sy, { align: 'right' });
      sy += 6;
    });

    y = Math.max(y, sy) + 8;
    doc.setFillColor(30, 64, 120);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Date', 16, y + 5);
    doc.text('Invoice #', 38, y + 5);
    doc.text('Description', 68, y + 5);
    doc.text('Charges', 130, y + 5, { align: 'right' });
    doc.text('Credits', 155, y + 5, { align: 'right' });
    doc.text('Line Total', 180, y + 5, { align: 'right' });
    y += 10;
    doc.setTextColor(0, 0, 0);

    report.lines.forEach((line, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 4, 182, 6, 'F');
      }
      doc.text(line.date, 16, y);
      doc.text(line.invoiceRef.substring(0, 12), 38, y);
      writeText(doc, line.description.substring(0, 28), 68, y);
      if (line.charges) doc.text(money(line.charges), 130, y, { align: 'right' });
      if (line.credits) doc.text(money(line.credits), 155, y, { align: 'right' });
      doc.text(formatAmount(line.lineTotal, money), 180, y, { align: 'right' });
      y += 6;
    });

    y += 4;
    doc.setFillColor(30, 64, 120);
    doc.rect(14, y, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Account Current Balance', 16, y + 5);
    doc.text(formatAmount(report.closingBalance, money), 180, y + 5, { align: 'right' });

    doc.save(`${report.partyType}-statement-${report.partyName.replace(/\s+/g, '-')}.pdf`);
  });
}

const PartyAccountStatementPage: React.FC = () => {
  const { partyId = '' } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const partyType = (
    searchParams.get('type') === 'supplier' || location.pathname.includes('/suppliers/')
      ? 'supplier'
      : 'customer'
  ) as PartyType;
  const partyNameParam = searchParams.get('name') || '';
  const { user } = useAuth();
  const { money, currency, loaded } = useStoreCurrency();
  const navigate = useNavigate();
  const [report, setReport] = useState<PartyStatementReport | null>(null);
  const [company, setCompany] = useState<StoreCompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backTo = partyType === 'supplier' ? '/admin/suppliers' : '/admin/customers';
  const partyLabel = partyType === 'customer' ? 'Customer' : 'Supplier';

  useEffect(() => {
    const storeId = getActualStoreId(user);
    if (!storeId || !partyId) {
      setLoading(false);
      setError('Missing store or party.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      buildPartyOperationalStatement({
        storeId,
        partyType,
        partyId,
        partyName: partyNameParam,
        currency,
      }),
      loadStoreCompanyProfile(storeId),
    ])
      .then(([nextReport, nextCompany]) => {
        if (cancelled) return;
        setReport(nextReport);
        setCompany(nextCompany);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not build statement.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency, partyId, partyNameParam, partyType, user]);

  if (loading || !loaded) {
    return (
      <AdminPageShell title={`${partyLabel} statement`} description="Loading…">
        <AdminEmbedLoader label="Building statement…" compact />
      </AdminPageShell>
    );
  }

  if (error || !report || !company) {
    return (
      <AdminPageShell title={`${partyLabel} statement`} description="Statement unavailable">
        <p className="text-red-700">{error || 'Statement not found.'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={backTo}>Back</Link>
        </Button>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title={`${partyLabel} account statement`}
      description={`${report.partyName} · ${report.statementNumber}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
          <Button size="sm" onClick={() => exportStatementPdf(report, company, money)}>
            <Download className="mr-1 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div>
            <h1 className="text-2xl font-bold text-[#1e4080]">{company.name}</h1>
            {company.slogan ? <p className="text-sm text-slate-600">{company.slogan}</p> : null}
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="mt-3 h-14 w-auto object-contain" />
            ) : (
              <div className="mt-3 flex h-14 w-40 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                Company logo
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-[#1e4080]">Statement</h2>
            <table className="ml-auto mt-2 text-sm">
              <tbody>
                <tr>
                  <td className="pr-3 text-right text-slate-500">Date</td>
                  <td className="font-medium">{report.statementDate}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-right text-slate-500">Statement #</td>
                  <td className="font-medium">{report.statementNumber}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-right text-slate-500">{partyLabel} ID</td>
                  <td className="font-medium">{report.billTo.accountCode || report.accountNo}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="bg-[#1e4080] px-3 py-2 text-sm font-semibold text-white">Bill To:</div>
            <div className="space-y-1 px-3 py-3 text-sm">
              <p className="font-semibold">{report.billTo.name}</p>
              {report.billTo.address ? <p>{report.billTo.address}</p> : null}
              {report.billTo.city || report.billTo.country ? (
                <p>{[report.billTo.city, report.billTo.country].filter(Boolean).join(', ')}</p>
              ) : null}
              {report.billTo.phone ? <p>Phone: {report.billTo.phone}</p> : null}
              {report.billTo.email ? <p>{report.billTo.email}</p> : null}
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="bg-[#1e4080] px-3 py-2 text-sm font-semibold text-white">Account Summary</div>
            <div className="divide-y text-sm">
              {[
                ['Previous Balance', report.openingBalance],
                ['Credits', report.totalCredits],
                ['New Charges', report.totalCharges],
                ['Total Balance Due', report.closingBalance],
              ].map(([label, amount]) => (
                <div key={String(label)} className="flex items-center justify-between px-3 py-2">
                  <span>{label}</span>
                  <span className="font-medium tabular-nums">{formatAmount(Number(amount), money)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2">
                <span>Payment Due Date</span>
                <span className="rounded border border-slate-300 px-2 py-0.5 font-medium">{report.paymentDueDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#1e4080] text-white">
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Invoice #</th>
                <th className="px-3 py-2 text-left font-semibold">Description</th>
                <th className="px-3 py-2 text-right font-semibold">Charges</th>
                <th className="px-3 py-2 text-right font-semibold">Credits</th>
                <th className="px-3 py-2 text-right font-semibold">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No transactions on this account yet.
                  </td>
                </tr>
              ) : (
                report.lines.map((line, index) => (
                  <tr key={`${line.invoiceRef}-${index}`} className={cn(index % 2 === 0 && 'bg-slate-50')}>
                    <td className="px-3 py-2 whitespace-nowrap">{line.date}</td>
                    <td className="px-3 py-2 font-mono text-xs">{line.invoiceRef}</td>
                    <td className="px-3 py-2">{line.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.charges ? money(line.charges) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.credits ? money(line.credits) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-semibold',
                        line.lineTotal < 0 && 'text-red-700',
                      )}
                    >
                      {formatAmount(line.lineTotal, money)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-0 flex items-center justify-between bg-[#1e4080] px-4 py-3 text-white">
          <span className="font-semibold">Account Current Balance</span>
          <span className="text-lg font-bold tabular-nums">{formatAmount(report.closingBalance, money)}</span>
        </div>

        <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
          <p>
            Please pay the total balance due by <strong>{report.paymentDueDate}</strong>.
          </p>
          <p>Make all checks payable to {company.name}.</p>
          <p className="font-semibold text-slate-800">Thank you for your business!</p>
          {(company.phone || company.email) && (
            <p>
              If you have any questions, contact us
              {company.phone ? ` at ${company.phone}` : ''}
              {company.email ? ` or ${company.email}` : ''}.
            </p>
          )}
        </div>

        {(company.address || company.website) && (
          <div className="mt-6 border-t pt-4 text-center text-xs text-slate-500">
            {[company.address, company.phone, company.email, company.website].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
};

export default PartyAccountStatementPage;
