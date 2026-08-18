import type { CnssBranchRow, LebanonCnss190AForm } from '@/lib/ledger/lebanonCnss190AForm';
import { formatMofAmount, MOF_VAT_FORM_STYLES } from '@/lib/ledger/lebanonVatReturnFormLayout';

export const CNSS_190A_FORM_STYLES = `
${MOF_VAT_FORM_STYLES.replace(/\.mof-vat-root/g, '.cnss-190a-root')}
.cnss-190a-root .cnss-title { text-align: center; font-weight: 700; font-size: 13px; margin: 6px 0; }
.cnss-190a-root .cnss-sub { text-align: center; font-size: 10px; margin-bottom: 8px; }
.cnss-190a-root .cnss-header-grid td { font-size: 10px; vertical-align: top; }
.cnss-190a-root .cnss-pay-opt { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; font-size: 10px; }
.cnss-190a-root .cnss-pay-code { background: #000; color: #fff; padding: 1px 4px; font-weight: 700; min-width: 14px; text-align: center; display: inline-block; }
.cnss-190a-root .cnss-ref { font-size: 9px; direction: ltr; text-align: center; }
.cnss-190a-root .cnss-rate { text-align: center; font-weight: 700; direction: ltr; }
.cnss-190a-root .cnss-foot { font-size: 10px; margin-top: 8px; }
.cnss-190a-root .cnss-form-id { font-size: 10px; font-weight: 700; margin-top: 8px; direction: ltr; text-align: left; }
.cnss-190a-root .cnss-delay-formula { font-size: 9px; text-align: center; direction: ltr; }
`;

export type Cnss190AFormMeta = {
  companyName?: string;
  companyNumber?: string;
  periodLabel?: string;
};

const PAYMENT_LABELS: Record<number, string> = {
  0: 'غير مدفوع',
  1: 'نقداً',
  2: 'تحويل مصرفي',
  3: 'شك',
};

function renderBranchRow(row: CnssBranchRow): string {
  return `<tr>
    <td class="lbl">${row.labelAr}</td>
    <td class="amt">${row.employeeCount}</td>
    <td class="amt">${formatMofAmount(row.wages)}</td>
    <td class="cnss-rate">${row.ratePercent}%</td>
    <td class="amt tot">${formatMofAmount(row.contributionsDue)}</td>
    <td class="amt">${formatMofAmount(row.contributionPaid)}</td>
    <td class="cnss-ref">${row.contributionPaidCode}</td>
    <td class="amt">${formatMofAmount(row.delayDue)}</td>
    <td class="amt">${formatMofAmount(row.delayPaid)}</td>
    <td class="cnss-ref">${row.delayPaidCode}</td>
    <td class="cnss-ref">${row.refCode}</td>
  </tr>`;
}

export function buildOfficialCnss190AFormHtml(form: LebanonCnss190AForm, meta: Cnss190AFormMeta = {}): string {
  const companyName = meta.companyName || form.companyName;
  const companyNumber = meta.companyNumber || form.companyNumber;
  const periodLabel = meta.periodLabel || `${form.startDate} → ${form.endDate}`;
  const branchRows = form.branches.map(renderBranchRow).join('');
  const payOptions = [3, 2, 1, 0]
    .map(
      (code) =>
        `<span class="cnss-pay-opt"><span class="cnss-pay-code">${code}</span> ${PAYMENT_LABELS[code]}${form.paymentMethod === code ? ' ✓' : ''}</span>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>CNSS 190A ${form.startDate} - ${form.endDate}</title>
  <style>${CNSS_190A_FORM_STYLES}
    body { margin: 10mm; }
    .cnss-190a-root { max-width: 297mm; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="cnss-190a-root">
    <div class="cnss-title">الصندوق الوطني للضمان الاجتماعي</div>
    <div class="cnss-sub">بيروت - لبنان</div>
    <div class="cnss-title">جدول الإشتراكات المستحقة عن ${periodLabel}</div>
    <div class="cnss-sub">المتوجب تسديدها خلال مهلة خمسة عشر يوماً إعتباراً من نهاية الشهر الإستحقاق أو من تاريخ الإستلام</div>

    <table class="cnss-header-grid" style="margin-bottom:8px">
      <tr>
        <td style="width:50%">
          <strong>حقل مخصص للصندوق</strong><br/>
          طريقة دفع الإشتراكات: ${payOptions}<br/>
          المدة / فترة: ${form.periodLabel} &nbsp; سنة: ${form.yearLabel}<br/>
          ملاحظات: ${form.notes || '—'}
        </td>
        <td style="width:50%">
          <strong>حقل مخصص لأصحاب العمل</strong><br/>
          إسم المؤسسة: ${companyName || '—'}<br/>
          رقم المؤسسة: ${companyNumber || '—'}<br/>
          ${form.declarationDay}/${form.declarationMonth}/${form.declarationYear} &nbsp; رقم المستند: ${form.documentNumber || '—'}
        </td>
      </tr>
    </table>

    <table>
      <thead>
        <tr class="hdr">
          <th>فرع</th>
          <th>عدد<br/>الأجراء</th>
          <th>الأجور ولواحقها</th>
          <th>المعدل</th>
          <th>الإشتراكات<br/>المستحقة</th>
          <th colspan="2">الإشتراكات</th>
          <th colspan="3">زيادات التأخير<div class="cnss-delay-formula">1/2000 × أيام × اشتراكات</div></th>
          <th>مرجع/فئة<br/>نوع/فرع</th>
        </tr>
        <tr class="hdr">
          <th colspan="5"></th>
          <th>المدفوع</th><th>الرمز</th>
          <th>المتوجب</th><th>المدفوع</th><th>الرمز</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${branchRows}</tbody>
    </table>

    <table style="margin-top:0;border-top:none">
      <tbody>
        <tr><td class="lbl">مجموع الإشتراكات المستحقة</td><td class="amt tot">${formatMofAmount(form.totalContributionsDue)}</td></tr>
        <tr><td class="lbl">التعويضات العائلية المدفوعة</td><td class="amt">${formatMofAmount(form.familyAllowancesPaid)}</td></tr>
        <tr><td class="lbl">الزيادة المتوجبة على الصندوق / الباقي المتوجب للصندوق</td><td class="amt tot">${formatMofAmount(form.balanceDueToFund)}</td></tr>
        <tr><td class="lbl">مجموع المبالغ المدفوعة</td><td class="amt tot">${formatMofAmount(form.totalAmountsPaid)}</td></tr>
      </tbody>
    </table>

    <div class="cnss-foot">
      <p>إن رب العمل الموقع أدناه يشهد على مسؤوليته أن الأجور وكافة المعلومات المصرح بها أعلاه هي مطابقة للحقيقة والواقع.</p>
      <p>توقيع رب العمل: .................... &nbsp; ختم المؤسسة &nbsp; في ${form.declarationDay}/${form.declarationMonth}/${form.declarationYear}</p>
      <p>المصفي: ........ &nbsp; المراقب: ........ &nbsp; المحاسب: ........</p>
      <p><strong>ملاحظة هامة:</strong> يتوجب إعادة هذا الجدول مع جدول التعويضات العائلية المرفق تحت طائلة عدم الأخذ بقيمة التعويضات العائلية المدفوعة من قبلكم.</p>
      <div class="cnss-form-id">CNSS 190A</div>
    </div>
  </div>
</body>
</html>`;
}

export function downloadOfficialCnss190AFormHtml(form: LebanonCnss190AForm, meta: Cnss190AFormMeta = {}): void {
  const html = buildOfficialCnss190AFormHtml(form, meta);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cnss-190a-${form.startDate}-${form.endDate}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printOfficialCnss190AForm(form: LebanonCnss190AForm, meta: Cnss190AFormMeta = {}): void {
  const html = buildOfficialCnss190AFormHtml(form, meta);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

export function downloadOfficialCnss190AFormExcel(form: LebanonCnss190AForm, meta: Cnss190AFormMeta = {}): void {
  const html = buildOfficialCnss190AFormHtml(form, meta).replace(
    '<html lang="ar"',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" lang="ar"',
  );
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cnss-190a-${form.startDate}-${form.endDate}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
