import type { LebanonVatReturnForm, VatFormCell, VatFormRow } from '@/lib/ledger/lebanonVatReturnForm';

export const MOF_VAT_FORM_STYLES = `
  .mof-vat-root {
    font-family: Arial, Tahoma, "Segoe UI", sans-serif;
    font-size: 11px;
    color: #000;
    direction: rtl;
    line-height: 1.25;
  }
  .mof-vat-root * { box-sizing: border-box; }
  .mof-vat-root table {
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
  }
  .mof-vat-root td, .mof-vat-root th {
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: middle;
  }
  .mof-vat-root .hdr {
    background: #d9d9d9;
    text-align: center;
    font-weight: 700;
    font-size: 10px;
    line-height: 1.2;
  }
  .mof-vat-root .na {
    background: #a6a6a6;
  }
  .mof-vat-root .code {
    background: #000;
    color: #fff;
    text-align: center;
    font-weight: 700;
    font-size: 11px;
    width: 34px;
    min-width: 34px;
    padding: 4px 2px;
  }
  .mof-vat-root .amt {
    text-align: left;
    direction: ltr;
    font-family: Arial, sans-serif;
    font-size: 11px;
    white-space: nowrap;
    background: #fff;
  }
  .mof-vat-root .lbl {
    text-align: right;
    font-size: 11px;
    background: #fff;
  }
  .mof-vat-root .sec {
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    background: #fff;
    width: 28px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    padding: 8px 2px;
  }
  .mof-vat-root .tot .amt, .mof-vat-root .tot .lbl {
    font-weight: 700;
  }
  .mof-vat-root .bridge .amt { font-weight: 700; }
  .mof-vat-root .bridge .lbl { font-weight: 700; }
  .mof-vat-root .misc-line {
    display: inline-block;
    min-width: 120px;
    border-bottom: 1px solid #000;
    height: 12px;
    vertical-align: bottom;
  }
  .mof-vat-meta {
    margin-bottom: 8px;
    font-size: 11px;
    direction: rtl;
    text-align: right;
  }
  .mof-vat-root .mof-vat-meta-input {
    border: 1px solid #999;
    border-radius: 2px;
    padding: 4px 8px;
    width: 100%;
    max-width: 360px;
    direction: rtl;
    text-align: right;
    font-size: 11px;
    background: #fffbeb;
  }
  .mof-vat-root .mof-vat-meta-input:focus {
    outline: none;
    border-color: #f59e0b;
    background: #fef3c7;
  }
  .mof-vat-root .mof-vat-input {
    width: 100%;
    min-width: 0;
    border: none;
    outline: none;
    background: #fffbeb;
    font-family: Arial, sans-serif;
    font-size: 11px;
    text-align: left;
    direction: ltr;
    padding: 2px 3px;
  }
  .mof-vat-root .mof-vat-input:focus {
    background: #fef3c7;
    box-shadow: inset 0 0 0 1px #f59e0b;
  }
  .mof-vat-root .amt.readonly {
    background: #ececec;
    color: #111;
  }
  .mof-vat-root .misc-input {
    border: none;
    border-bottom: 1px solid #000;
    background: #fffbeb;
    min-width: 140px;
    font-size: 11px;
    direction: rtl;
    text-align: right;
    padding: 0 2px;
  }
  @media print {
    .mof-vat-no-print { display: none !important; }
    .mof-vat-root { font-size: 10px; }
    .mof-vat-root .mof-vat-input,
    .mof-vat-root .mof-vat-meta-input,
    .mof-vat-root .misc-input {
      background: #fff !important;
      box-shadow: none !important;
    }
  }
`;

export function formatMofAmount(value: VatFormCell): string {
  if (value === 'na') return '';
  const n = Math.round(value);
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function cellClass(value: VatFormCell, extra = ''): string {
  if (value === 'na') return `na ${extra}`.trim();
  return `amt ${extra}`.trim();
}

function renderAmountCell(value: VatFormCell, extra = ''): string {
  if (value === 'na') return `<td class="na"></td>`;
  return `<td class="${cellClass(value, extra)}">${formatMofAmount(value)}</td>`;
}

function renderMainRow(row: VatFormRow, sectionCell = '', meta: MofVatFormMeta = {}): string {
  const total = row.isTotal ? ' tot' : '';
  const label =
    row.code === 180 && meta.miscExplain
      ? `${row.labelAr} ${meta.miscExplain}`
      : row.code === 180
        ? `${row.labelAr} <span class="misc-line">&nbsp;</span>`
        : row.labelAr;
  return `<tr class="${total}">
    ${sectionCell}
    <td class="lbl">${label}</td>
    <td class="code">${row.code}</td>
    ${renderAmountCell(row.col1, total)}
    ${renderAmountCell(row.col2, total)}
    ${renderAmountCell(row.col3, total)}
  </tr>`;
}

function renderSettlementRow(row: VatFormRow): string {
  const total = row.isTotal ? ' tot' : '';
  return `<tr class="${total}">
    <td></td>
    <td class="lbl">${row.labelAr}</td>
    <td class="code">${row.code}</td>
    ${renderAmountCell(row.col1, total)}
    <td class="na"></td>
    <td class="na"></td>
  </tr>`;
}

export type MofVatFormMeta = {
  companyName?: string;
  taxId?: string;
  miscExplain?: string;
  periodLabel?: string;
};

export function buildOfficialMofVatFormHtml(form: LebanonVatReturnForm, meta: MofVatFormMeta = {}): string {
  const revenueRows = form.revenues.filter((r) => !r.isTotal);
  const revenueTotal = form.revenues.find((r) => r.code === 190)!;
  const purchaseRows = form.purchases.filter((r) => !r.isTotal);
  const purchaseTotal = form.purchases.find((r) => r.code === 250)!;

  const revenueBody = revenueRows
    .map((row, idx) =>
      renderMainRow(
        row,
        idx === 0 ? `<td class="sec" rowspan="${revenueRows.length + 1}">الإيرادات</td>` : '',
        meta,
      ),
    )
    .join('');

  const purchaseBody = purchaseRows
    .map((row, idx) =>
      renderMainRow(
        row,
        idx === 0 ? `<td class="sec" rowspan="${purchaseRows.length + 1}">المشتريات والأعباء</td>` : '',
        meta,
      ),
    )
    .join('');

  const settlementHeader = `<tr class="hdr">
    <th></th>
    <th class="lbl"></th>
    <th class="code"></th>
    <th>المبلغ (ل.ل.) (١)</th>
    <th></th>
    <th></th>
  </tr>`;

  const settlementBody = form.settlement.map((r) => renderSettlementRow(r)).join('');

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
  <title>إقرار ضريبة القيمة المضافة ${form.startDate} - ${form.endDate}</title>
  <style>${MOF_VAT_FORM_STYLES}
    body { margin: 12mm; }
    .mof-vat-root { max-width: 210mm; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="mof-vat-root">
    <div class="mof-vat-meta">${metaLines}</div>
    <table>
      <colgroup>
        <col style="width:28px" />
        <col style="width:36%" />
        <col style="width:34px" />
        <col style="width:17%" />
        <col style="width:17%" />
        <col style="width:17%" />
      </colgroup>
      <thead>
        <tr class="hdr">
          <th colspan="2"></th>
          <th></th>
          <th>المبلغ الإجمالي (ل.ل.) (١)</th>
          <th>الضريبة المستحقة للدفع (ل.ل.) (٢)</th>
          <th>الضريبة القابلة للحسم (ل.ل.) (٣)</th>
        </tr>
      </thead>
      <tbody>
        ${revenueBody}
        ${renderMainRow(revenueTotal, '', meta)}
        ${purchaseBody}
        ${renderMainRow(purchaseTotal, '', meta)}
      </tbody>
    </table>
    <table style="margin-top:0;border-top:none">
      <colgroup>
        <col style="width:28px" />
        <col style="width:36%" />
        <col style="width:34px" />
        <col style="width:17%" />
        <col style="width:17%" />
        <col style="width:17%" />
      </colgroup>
      <tbody>
        ${settlementHeader}
        ${settlementBody}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function downloadOfficialMofVatFormHtml(form: LebanonVatReturnForm, meta: MofVatFormMeta = {}): void {
  const html = buildOfficialMofVatFormHtml(form, meta);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mof-vat-return-${form.startDate}-${form.endDate}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printOfficialMofVatForm(form: LebanonVatReturnForm, meta: MofVatFormMeta = {}): void {
  const html = buildOfficialMofVatFormHtml(form, meta);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

export function downloadOfficialMofVatFormExcel(form: LebanonVatReturnForm, meta: MofVatFormMeta = {}): void {
  const html = buildOfficialMofVatFormHtml(form, meta).replace(
    '<html lang="ar"',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" lang="ar"',
  );
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mof-vat-return-${form.startDate}-${form.endDate}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
