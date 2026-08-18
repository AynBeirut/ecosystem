import type { LebanonR10Form, R10FormCell } from '@/lib/ledger/lebanonR10Form';
import { formatMofAmount, MOF_VAT_FORM_STYLES } from '@/lib/ledger/lebanonVatReturnFormLayout';

export const MOF_R10_FORM_STYLES = MOF_VAT_FORM_STYLES.replace(/\.mof-vat-root/g, '.mof-r10-root');

export type MofR10FormMeta = {
  companyName?: string;
  taxId?: string;
  periodLabel?: string;
};

function renderAmount(value: R10FormCell, total = false): string {
  if (value === 'na') return `<td class="na"></td>`;
  return `<td class="amt${total ? ' tot' : ''}">${formatMofAmount(value)}</td>`;
}

function renderDualRow(row: { code: number; labelAr: string; board: R10FormCell; employees: R10FormCell; isTotal?: boolean }): string {
  const total = row.isTotal ? ' tot' : '';
  return `<tr class="${total}">
    <td class="lbl">${row.labelAr}</td>
    <td class="code">${row.code}</td>
    ${renderAmount(row.board, row.isTotal)}
    ${renderAmount(row.employees, row.isTotal)}
  </tr>`;
}

function renderSingleRow(row: { code: number; labelAr: string; amount: R10FormCell; isTotal?: boolean }): string {
  const total = row.isTotal ? ' tot' : '';
  return `<tr class="${total}">
    <td class="lbl">${row.labelAr}</td>
    <td class="code">${row.code}</td>
    ${renderAmount(row.amount, row.isTotal)}
  </tr>`;
}

export function buildOfficialMofR10FormHtml(form: LebanonR10Form, meta: MofR10FormMeta = {}): string {
  const headerRows = form.headerCounts
    .map(
      (h) => `<tr>
        <td class="lbl">${h.labelAr}</td>
        <td class="code">${h.code}</td>
        <td class="amt">${h.value}</td>
      </tr>`,
    )
    .join('');

  const chapterBody = form.chapterTwo.map((r) => renderDualRow(r)).join('');
  const flatBody = form.flatWages.map((r) => renderSingleRow(r)).join('');
  const totalsBody = form.totals.map((r) => renderSingleRow(r)).join('');

  const metaLines = [
    meta.companyName ? `<div><strong>اسم المكلف:</strong> ${meta.companyName}</div>` : '',
    meta.taxId ? `<div><strong>رقم الملف:</strong> ${meta.taxId}</div>` : '',
    `<div><strong>الفترة:</strong> ${meta.periodLabel || `${form.startDate} → ${form.endDate}`}</div>`,
  ]
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>نموذج R10 ${form.startDate} - ${form.endDate}</title>
  <style>${MOF_R10_FORM_STYLES}
    body { margin: 12mm; }
    .mof-r10-root { max-width: 210mm; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="mof-r10-root">
    <div class="mof-vat-meta">${metaLines}</div>
    <table style="margin-bottom:8px">
      <tbody>${headerRows}</tbody>
    </table>
    <table>
      <thead>
        <tr class="hdr">
          <th colspan="2">ضريبة الباب الثاني</th>
          <th>رئيس وأعضاء مجلس الإدارة (1)</th>
          <th>المستخدمون والأجراء (2)</th>
        </tr>
      </thead>
      <tbody>${chapterBody}</tbody>
    </table>
    <table style="margin-top:0;border-top:none">
      <thead>
        <tr class="hdr"><th colspan="3">أجور مقطوعة</th></tr>
      </thead>
      <tbody>${flatBody}${totalsBody}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export function downloadOfficialMofR10FormHtml(form: LebanonR10Form, meta: MofR10FormMeta = {}): void {
  const html = buildOfficialMofR10FormHtml(form, meta);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mof-r10-${form.startDate}-${form.endDate}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printOfficialMofR10Form(form: LebanonR10Form, meta: MofR10FormMeta = {}): void {
  const html = buildOfficialMofR10FormHtml(form, meta);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

export function downloadOfficialMofR10FormExcel(form: LebanonR10Form, meta: MofR10FormMeta = {}): void {
  const html = buildOfficialMofR10FormHtml(form, meta).replace(
    '<html lang="ar"',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" lang="ar"',
  );
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mof-r10-${form.startDate}-${form.endDate}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
