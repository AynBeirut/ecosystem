import { useCallback, useState } from 'react';
import type { LebanonVatReturnForm, VatFormCell, VatFormRow } from '@/lib/ledger/lebanonVatReturnForm';
import { COMPUTED_VAT_ROW_CODES, parseMofAmountInput } from '@/lib/ledger/lebanonVatReturnForm';
import { formatMofAmount, MOF_VAT_FORM_STYLES } from '@/lib/ledger/lebanonVatReturnFormLayout';
import type { VatFormDraftMeta } from '@/lib/ledger/lebanonVatFormDraft';

type ColKey = 'col1' | 'col2' | 'col3';

type Props = {
  form: LebanonVatReturnForm;
  meta: VatFormDraftMeta;
  onCellChange: (code: number, col: ColKey, value: number) => void;
  onMetaChange: (patch: Partial<VatFormDraftMeta>) => void;
};

function AmountCell({
  rowCode,
  col,
  value,
  total,
  onCellChange,
}: {
  rowCode: number;
  col: ColKey;
  value: VatFormCell;
  total?: boolean;
  onCellChange: (code: number, col: ColKey, value: number) => void;
}) {
  const [draftText, setDraftText] = useState<string | null>(null);
  const readOnly = total || COMPUTED_VAT_ROW_CODES.has(rowCode);

  if (value === 'na') {
    return <td className="na" aria-hidden />;
  }

  const display = draftText ?? formatMofAmount(value);

  if (readOnly) {
    return <td className={`amt readonly${total ? ' tot' : ''}`}>{formatMofAmount(value)}</td>;
  }

  return (
    <td className="amt">
      <input
        type="text"
        inputMode="numeric"
        className="mof-vat-input"
        value={display}
        onChange={(e) => setDraftText(e.target.value)}
        onBlur={() => {
          const parsed = parseMofAmountInput(draftText ?? '');
          setDraftText(null);
          onCellChange(rowCode, col, parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </td>
  );
}

function MainRow({
  row,
  section,
  meta,
  onCellChange,
  onMetaChange,
}: {
  row: VatFormRow;
  section?: React.ReactNode;
  meta: VatFormDraftMeta;
  onCellChange: (code: number, col: ColKey, value: number) => void;
  onMetaChange: (patch: Partial<VatFormDraftMeta>) => void;
}) {
  const total = row.isTotal;
  return (
    <tr className={total ? 'tot' : undefined}>
      {section}
      <td className="lbl">
        {row.code === 180 ? (
          <>
            {row.labelAr}{' '}
            <input
              type="text"
              className="misc-input"
              value={meta.miscExplain}
              placeholder="………………"
              onChange={(e) => onMetaChange({ miscExplain: e.target.value })}
            />
          </>
        ) : (
          row.labelAr
        )}
      </td>
      <td className="code">{row.code}</td>
      <AmountCell rowCode={row.code} col="col1" value={row.col1} total={total} onCellChange={onCellChange} />
      <AmountCell rowCode={row.code} col="col2" value={row.col2} total={total} onCellChange={onCellChange} />
      <AmountCell rowCode={row.code} col="col3" value={row.col3} total={total} onCellChange={onCellChange} />
    </tr>
  );
}

function SettlementRow({
  row,
  onCellChange,
}: {
  row: VatFormRow;
  onCellChange: (code: number, col: ColKey, value: number) => void;
}) {
  const total = row.isTotal;
  return (
    <tr className={total ? 'tot' : undefined}>
      <td />
      <td className="lbl">{row.labelAr}</td>
      <td className="code">{row.code}</td>
      <AmountCell rowCode={row.code} col="col1" value={row.col1} total={total} onCellChange={onCellChange} />
      <td className="na" />
      <td className="na" />
    </tr>
  );
}

export default function LebanonVatReturnFormView({ form, meta, onCellChange, onMetaChange }: Props) {
  const revenueRows = form.revenues.filter((r) => !r.isTotal);
  const revenueTotal = form.revenues.find((r) => r.code === 190)!;
  const purchaseRows = form.purchases.filter((r) => !r.isTotal);
  const purchaseTotal = form.purchases.find((r) => r.code === 250)!;

  const handleMetaChange = useCallback(
    (patch: Partial<VatFormDraftMeta>) => onMetaChange(patch),
    [onMetaChange],
  );

  return (
    <>
      <style>{MOF_VAT_FORM_STYLES}</style>
      <div className="mof-vat-root">
        <div className="mof-vat-meta">
          <div className="mb-2">
            <strong>اسم المكلف:</strong>{' '}
            <input
              type="text"
              className="mof-vat-meta-input"
              value={meta.companyName}
              onChange={(e) => handleMetaChange({ companyName: e.target.value })}
              placeholder="اسم الشركة"
            />
          </div>
          <div className="mb-2">
            <strong>رقم الملف:</strong>{' '}
            <input
              type="text"
              className="mof-vat-meta-input"
              value={meta.taxId}
              onChange={(e) => handleMetaChange({ taxId: e.target.value })}
              placeholder="رقم الملف الضريبي"
            />
          </div>
          <div>
            <strong>الفترة:</strong> {form.startDate} → {form.endDate}
          </div>
        </div>

        <table>
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: '36%' }} />
            <col style={{ width: 34 }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr className="hdr">
              <th colSpan={2} />
              <th />
              <th>المبلغ الإجمالي (ل.ل.) (١)</th>
              <th>الضريبة المستحقة للدفع (ل.ل.) (٢)</th>
              <th>الضريبة القابلة للحسم (ل.ل.) (٣)</th>
            </tr>
          </thead>
          <tbody>
            {revenueRows.map((row, idx) => (
              <MainRow
                key={row.code}
                row={row}
                meta={meta}
                onCellChange={onCellChange}
                onMetaChange={handleMetaChange}
                section={
                  idx === 0 ? (
                    <td className="sec" rowSpan={revenueRows.length + 1}>
                      الإيرادات
                    </td>
                  ) : undefined
                }
              />
            ))}
            <MainRow row={revenueTotal} meta={meta} onCellChange={onCellChange} onMetaChange={handleMetaChange} />
            {purchaseRows.map((row, idx) => (
              <MainRow
                key={row.code}
                row={row}
                meta={meta}
                onCellChange={onCellChange}
                onMetaChange={handleMetaChange}
                section={
                  idx === 0 ? (
                    <td className="sec" rowSpan={purchaseRows.length + 1}>
                      المشتريات والأعباء
                    </td>
                  ) : undefined
                }
              />
            ))}
            <MainRow row={purchaseTotal} meta={meta} onCellChange={onCellChange} onMetaChange={handleMetaChange} />
          </tbody>
        </table>

        <table style={{ marginTop: 0, borderTop: 'none' }}>
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: '36%' }} />
            <col style={{ width: 34 }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <tbody>
            <tr className="hdr">
              <th />
              <th className="lbl" />
              <th className="code" />
              <th>المبلغ (ل.ل.) (١)</th>
              <th />
              <th />
            </tr>
            {form.settlement.map((row) => (
              <SettlementRow key={row.code} row={row} onCellChange={onCellChange} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
