import { useState } from 'react';
import type { CnssBranchKey, CnssBranchRow, CnssPaymentMethod, LebanonCnss190AForm } from '@/lib/ledger/lebanonCnss190AForm';
import { parseMofAmountInput } from '@/lib/ledger/lebanonCnss190AForm';
import { CNSS_190A_FORM_STYLES } from '@/lib/ledger/lebanonCnss190AFormLayout';
import { formatMofAmount } from '@/lib/ledger/lebanonVatReturnFormLayout';
import type { Cnss190AFormDraftMeta } from '@/lib/ledger/lebanonCnss190AFormDraft';

type Props = {
  form: LebanonCnss190AForm;
  meta: Cnss190AFormDraftMeta;
  onBranchChange: (
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
  ) => void;
  onFormChange: (patch: Partial<LebanonCnss190AForm>) => void;
  onMetaChange: (patch: Partial<Cnss190AFormDraftMeta>) => void;
};

function AmountInput({
  value,
  readOnly,
  onCommit,
}: {
  value: number;
  readOnly?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
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

const PAYMENT_OPTIONS: Array<{ code: CnssPaymentMethod; label: string }> = [
  { code: 3, label: 'شك' },
  { code: 2, label: 'تحويل مصرفي' },
  { code: 1, label: 'نقداً' },
  { code: 0, label: 'غير مدفوع' },
];

export default function LebanonCnss190AFormView({
  form,
  meta,
  onBranchChange,
  onFormChange,
  onMetaChange,
}: Props) {
  return (
    <>
      <style>{CNSS_190A_FORM_STYLES}</style>
      <div className="cnss-190a-root">
        <div className="cnss-title">الصندوق الوطني للضمان الاجتماعي</div>
        <div className="cnss-sub">بيروت - لبنان</div>
        <div className="cnss-title">جدول الإشتراكات المستحقة عن {form.periodLabel || `${form.startDate} → ${form.endDate}`}</div>
        <div className="cnss-sub">
          المتوجب تسديدها خلال مهلة خمسة عشر يوماً إعتباراً من نهاية الشهر الإستحقاق أو من تاريخ الإستلام
        </div>

        <table className="cnss-header-grid" style={{ marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%' }}>
                <strong>حقل مخصص للصندوق</strong>
                <div className="mt-2">
                  طريقة دفع الإشتراكات:
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label key={opt.code} className="cnss-pay-opt ml-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cnss-pay"
                        checked={form.paymentMethod === opt.code}
                        onChange={() => onFormChange({ paymentMethod: opt.code })}
                      />
                      <span className="cnss-pay-code">{opt.code}</span> {opt.label}
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  المدة / فترة:{' '}
                  <input
                    className="mof-vat-meta-input"
                    value={form.periodLabel}
                    onChange={(e) => onFormChange({ periodLabel: e.target.value })}
                  />{' '}
                  سنة:{' '}
                  <input
                    className="mof-vat-meta-input"
                    style={{ width: 60 }}
                    value={form.yearLabel}
                    onChange={(e) => onFormChange({ yearLabel: e.target.value })}
                  />
                </div>
                <div className="mt-2">
                  ملاحظات:{' '}
                  <input
                    className="mof-vat-meta-input"
                    style={{ width: '70%' }}
                    value={form.notes}
                    onChange={(e) => onFormChange({ notes: e.target.value })}
                  />
                </div>
              </td>
              <td style={{ width: '50%' }}>
                <strong>حقل مخصص لأصحاب العمل</strong>
                <div className="mt-2">
                  إسم المؤسسة:{' '}
                  <input
                    className="mof-vat-meta-input"
                    value={meta.companyName}
                    onChange={(e) => onMetaChange({ companyName: e.target.value })}
                  />
                </div>
                <div className="mt-2">
                  رقم المؤسسة:{' '}
                  <input
                    className="mof-vat-meta-input"
                    value={meta.companyNumber}
                    onChange={(e) => onMetaChange({ companyNumber: e.target.value })}
                  />
                </div>
                <div className="mt-2">
                  <input
                    className="mof-vat-meta-input"
                    style={{ width: 36 }}
                    value={form.declarationDay}
                    onChange={(e) => onFormChange({ declarationDay: e.target.value })}
                  />
                  /
                  <input
                    className="mof-vat-meta-input"
                    style={{ width: 36 }}
                    value={form.declarationMonth}
                    onChange={(e) => onFormChange({ declarationMonth: e.target.value })}
                  />
                  /
                  <input
                    className="mof-vat-meta-input"
                    style={{ width: 48 }}
                    value={form.declarationYear}
                    onChange={(e) => onFormChange({ declarationYear: e.target.value })}
                  />{' '}
                  رقم المستند:{' '}
                  <input
                    className="mof-vat-meta-input"
                    value={form.documentNumber}
                    onChange={(e) => onFormChange({ documentNumber: e.target.value })}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table>
          <thead>
            <tr className="hdr">
              <th>فرع</th>
              <th>عدد الأجراء</th>
              <th>الأجور ولواحقها</th>
              <th>المعدل</th>
              <th>الإشتراكات المستحقة</th>
              <th colSpan={2}>الإشتراكات</th>
              <th colSpan={3}>
                زيادات التأخير
                <div className="cnss-delay-formula">1/2000 × أيام × اشتراكات</div>
              </th>
              <th>مرجع/فئة</th>
            </tr>
            <tr className="hdr">
              <th colSpan={5} />
              <th>المدفوع</th>
              <th>الرمز</th>
              <th>المتوجب</th>
              <th>المدفوع</th>
              <th>الرمز</th>
              <th>نوع/فرع</th>
            </tr>
          </thead>
          <tbody>
            {form.branches.map((row) => (
              <tr key={row.key}>
                <td className="lbl">{row.labelAr}</td>
                <AmountInput
                  value={row.employeeCount}
                  onCommit={(v) => onBranchChange(row.key, 'employeeCount', v)}
                />
                <AmountInput value={row.wages} onCommit={(v) => onBranchChange(row.key, 'wages', v)} />
                <td className="cnss-rate">{row.ratePercent}%</td>
                <AmountInput value={row.contributionsDue} readOnly onCommit={() => {}} />
                <AmountInput
                  value={row.contributionPaid}
                  onCommit={(v) => onBranchChange(row.key, 'contributionPaid', v)}
                />
                <td className="amt">
                  <input
                    className="mof-vat-input"
                    style={{ fontSize: 10 }}
                    value={row.contributionPaidCode}
                    onChange={(e) => onBranchChange(row.key, 'contributionPaidCode', e.target.value)}
                  />
                </td>
                <td className="amt">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mof-vat-input"
                    style={{ width: 40, fontSize: 10, marginBottom: 2 }}
                    value={String(row.delayDays)}
                    onChange={(e) =>
                      onBranchChange(row.key, 'delayDays', parseMofAmountInput(e.target.value))
                    }
                  />
                  <div className="readonly tot">{formatMofAmount(row.delayDue)}</div>
                </td>
                <AmountInput
                  value={row.delayPaid}
                  onCommit={(v) => onBranchChange(row.key, 'delayPaid', v)}
                />
                <td className="amt">
                  <input
                    className="mof-vat-input"
                    style={{ fontSize: 10 }}
                    value={row.delayPaidCode}
                    onChange={(e) => onBranchChange(row.key, 'delayPaidCode', e.target.value)}
                  />
                </td>
                <td className="cnss-ref">{row.refCode}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ marginTop: 0, borderTop: 'none' }}>
          <tbody>
            <tr>
              <td className="lbl">مجموع الإشتراكات المستحقة</td>
              <AmountInput value={form.totalContributionsDue} readOnly onCommit={() => {}} />
            </tr>
            <tr>
              <td className="lbl">التعويضات العائلية المدفوعة</td>
              <AmountInput
                value={form.familyAllowancesPaid}
                onCommit={(v) => onFormChange({ familyAllowancesPaid: v })}
              />
            </tr>
            <tr>
              <td className="lbl">الزيادة المتوجبة على الصندوق / الباقي المتوجب للصندوق</td>
              <AmountInput value={form.balanceDueToFund} readOnly onCommit={() => {}} />
            </tr>
            <tr>
              <td className="lbl">مجموع المبالغ المدفوعة</td>
              <AmountInput value={form.totalAmountsPaid} readOnly onCommit={() => {}} />
            </tr>
          </tbody>
        </table>

        <div className="cnss-foot">
          <p>إن رب العمل الموقع أدناه يشهد على مسؤوليته أن الأجور وكافة المعلومات المصرح بها أعلاه هي مطابقة للحقيقة والواقع.</p>
          <p className="cnss-form-id">CNSS 190A · {form.startDate} → {form.endDate}</p>
        </div>
      </div>
    </>
  );
}
