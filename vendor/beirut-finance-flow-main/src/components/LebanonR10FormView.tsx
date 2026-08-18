import { useState } from 'react';
import type { LebanonR10Form, R10FormCell } from '@/lib/ledger/lebanonR10Form';
import {
  COMPUTED_R10_DUAL_CODES,
  COMPUTED_R10_SINGLE_CODES,
  parseMofAmountInput,
} from '@/lib/ledger/lebanonR10Form';
import type { R10FormDraftMeta } from '@/lib/ledger/lebanonR10FormDraft';
import { formatMofAmount, MOF_VAT_FORM_STYLES } from '@/lib/ledger/lebanonVatReturnFormLayout';

type Props = {
  form: LebanonR10Form;
  meta: R10FormDraftMeta;
  onDualChange: (code: number, col: 'board' | 'employees', value: number) => void;
  onSingleChange: (code: number, value: number) => void;
  onHeaderChange: (code: 70 | 80 | 90, value: number) => void;
  onMetaChange: (patch: Partial<R10FormDraftMeta>) => void;
};

function AmountInput({
  value,
  readOnly,
  onCommit,
}: {
  value: R10FormCell;
  readOnly?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (value === 'na') return <td className="na" aria-hidden />;
  if (readOnly) return <td className="amt readonly tot">{formatMofAmount(value)}</td>;
  return (
    <td className="amt">
      <input
        type="text"
        inputMode="numeric"
        className="mof-vat-input"
        value={draft ?? formatMofAmount(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(parseMofAmountInput(draft ?? ''));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </td>
  );
}

export default function LebanonR10FormView({
  form,
  meta,
  onDualChange,
  onSingleChange,
  onHeaderChange,
  onMetaChange,
}: Props) {
  return (
    <>
      <style>{MOF_VAT_FORM_STYLES.replace(/\.mof-vat-root/g, '.mof-r10-root')}</style>
      <div className="mof-r10-root">
        <div className="mof-vat-meta">
          <div className="mb-2">
            <strong>اسم المكلف:</strong>{' '}
            <input
              type="text"
              className="mof-vat-meta-input"
              value={meta.companyName}
              onChange={(e) => onMetaChange({ companyName: e.target.value })}
            />
          </div>
          <div className="mb-2">
            <strong>رقم الملف:</strong>{' '}
            <input
              type="text"
              className="mof-vat-meta-input"
              value={meta.taxId}
              onChange={(e) => onMetaChange({ taxId: e.target.value })}
            />
          </div>
          <div>
            <strong>الفترة:</strong> {form.startDate} → {form.endDate}
          </div>
        </div>

        <table style={{ marginBottom: 8 }}>
          <tbody>
            {form.headerCounts.map((row) => (
              <tr key={row.code}>
                <td className="lbl">{row.labelAr}</td>
                <td className="code">{row.code}</td>
                <td className="amt">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mof-vat-input"
                    value={String(row.value)}
                    onChange={(e) =>
                      onHeaderChange(row.code, parseMofAmountInput(e.target.value))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <table>
          <colgroup>
            <col style={{ width: '44%' }} />
            <col style={{ width: 34 }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr className="hdr">
              <th colSpan={2}>ضريبة الباب الثاني</th>
              <th>رئيس وأعضاء مجلس الإدارة (1)</th>
              <th>المستخدمون والأجراء (2)</th>
            </tr>
          </thead>
          <tbody>
            {form.chapterTwo.map((row) => (
              <tr key={row.code} className={row.isTotal ? 'tot' : undefined}>
                <td className="lbl">{row.labelAr}</td>
                <td className="code">{row.code}</td>
                <AmountInput
                  value={row.board}
                  readOnly={row.isTotal || COMPUTED_R10_DUAL_CODES.has(row.code)}
                  onCommit={(v) => onDualChange(row.code, 'board', v)}
                />
                <AmountInput
                  value={row.employees}
                  readOnly={row.isTotal || COMPUTED_R10_DUAL_CODES.has(row.code)}
                  onCommit={(v) => onDualChange(row.code, 'employees', v)}
                />
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ marginTop: 0, borderTop: 'none' }}>
          <colgroup>
            <col style={{ width: '72%' }} />
            <col style={{ width: 34 }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr className="hdr">
              <th colSpan={3}>أجور مقطوعة</th>
            </tr>
          </thead>
          <tbody>
            {form.flatWages.map((row) => (
              <tr key={row.code}>
                <td className="lbl">{row.labelAr}</td>
                <td className="code">{row.code}</td>
                <AmountInput value={row.amount} onCommit={(v) => onSingleChange(row.code, v)} />
              </tr>
            ))}
            {form.totals.map((row) => (
              <tr key={row.code} className={row.isTotal ? 'tot' : undefined}>
                <td className="lbl">{row.labelAr}</td>
                <td className="code">{row.code}</td>
                <AmountInput
                  value={row.amount}
                  readOnly={COMPUTED_R10_SINGLE_CODES.has(row.code)}
                  onCommit={(v) => onSingleChange(row.code, v)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
