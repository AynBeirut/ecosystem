import type { IncomeStatementReport, VatFilingSummaryReport } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type VatFormCell = number | 'na';

export type VatFormRow = {
  code: number;
  labelAr: string;
  col1: VatFormCell;
  col2: VatFormCell;
  col3: VatFormCell;
  isTotal?: boolean;
};

export type LebanonVatReturnForm = {
  startDate: string;
  endDate: string;
  currency: string;
  revenues: VatFormRow[];
  purchases: VatFormRow[];
  settlement: VatFormRow[];
};

const PURCHASE_VAT_SOURCES = new Set(['purchase', 'purchase_payment', 'purchase_receive', 'goods_receipt']);

function amt(value: number, enabled: boolean): VatFormCell {
  if (!enabled) return 'na';
  return round2(value);
}

function sumColumn(rows: VatFormRow[], col: 'col1' | 'col2' | 'col3'): number {
  return round2(
    rows.reduce((sum, row) => {
      const v = row[col];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0),
  );
}

/** Rows whose amounts are computed — not user-editable. */
export const COMPUTED_VAT_ROW_CODES = new Set([190, 250, 300, 330, 340, 350, 370]);

export function parseMofAmountInput(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : 0;
}

function patchRows(rows: VatFormRow[], code: number, col: 'col1' | 'col2' | 'col3', value: number): VatFormRow[] {
  return rows.map((row) => {
    if (row.code !== code || row.isTotal || row[col] === 'na') return row;
    return { ...row, [col]: value };
  });
}

export function updateVatFormCell(
  form: LebanonVatReturnForm,
  code: number,
  col: 'col1' | 'col2' | 'col3',
  value: number,
): LebanonVatReturnForm {
  if (COMPUTED_VAT_ROW_CODES.has(code)) return form;
  return {
    ...form,
    revenues: patchRows(form.revenues, code, col, value),
    purchases: patchRows(form.purchases, code, col, value),
    settlement: patchRows(form.settlement, code, col, value),
  };
}

/** Recompute totals (190, 250) and settlement lines 300–370 from detail rows. */
export function recalculateLebanonVatForm(form: LebanonVatReturnForm): LebanonVatReturnForm {
  const revenueDetail = form.revenues.filter((r) => !r.isTotal);
  const purchaseDetail = form.purchases.filter((r) => !r.isTotal);

  const revenueTotal: VatFormRow = {
    code: 190,
    labelAr: 'المجموع',
    col1: sumColumn(revenueDetail, 'col1'),
    col2: sumColumn(revenueDetail, 'col2'),
    col3: sumColumn(revenueDetail, 'col3'),
    isTotal: true,
  };

  const purchaseTotal: VatFormRow = {
    code: 250,
    labelAr: 'المجموع',
    col1: sumColumn(purchaseDetail, 'col1'),
    col2: 'na',
    col3: sumColumn(purchaseDetail, 'col3'),
    isTotal: true,
  };

  const taxDue = revenueTotal.col2 as number;
  const deductible = purchaseTotal.col3 as number;
  const settlementByCode = new Map(form.settlement.map((r) => [r.code, r]));
  const previousCredit = (settlementByCode.get(310)?.col1 as number) || 0;
  const netDue = round2(Math.max(0, taxDue - previousCredit - deductible));
  const refundableCarry = round2(Math.max(0, deductible + previousCredit - taxDue));

  const penaltyCodes = [360, 361, 362, 363, 364, 365, 366, 367, 368];
  const penaltiesTotal = round2(
    penaltyCodes.reduce((s, c) => s + ((settlementByCode.get(c)?.col1 as number) || 0), 0),
  );
  const totalPayable = round2(netDue + penaltiesTotal);

  const settlement = form.settlement.map((row) => {
    if (row.code === 300) return { ...row, col1: taxDue };
    if (row.code === 330) return { ...row, col1: deductible };
    if (row.code === 340) return { ...row, col1: netDue, isTotal: true };
    if (row.code === 350) return { ...row, col1: refundableCarry };
    if (row.code === 370) return { ...row, col1: totalPayable, isTotal: true };
    return row;
  });

  return {
    ...form,
    revenues: [...revenueDetail, revenueTotal],
    purchases: [...purchaseDetail, purchaseTotal],
    settlement,
  };
}

function inputVatFromPurchases(vatFiling: VatFilingSummaryReport): number {
  return round2(
    vatFiling.bySource
      .filter((r) => PURCHASE_VAT_SOURCES.has(r.sourceType) || r.sourceType.includes('purchase'))
      .reduce((s, r) => s + r.inputNet, 0),
  );
}

function inputVatFromExpenses(vatFiling: VatFilingSummaryReport, purchaseInput: number): number {
  return round2(Math.max(0, vatFiling.inputVat.net - purchaseInput));
}

export function buildLebanonVatReturnForm(
  vatFiling: VatFilingSummaryReport,
  incomeStatement: IncomeStatementReport,
  options?: {
    previousPeriodCredit?: number;
    advancesReceived?: number;
    advancesReceivedVat?: number;
    advancesPaid?: number;
    advancesPaidVat?: number;
    exemptWithDeduction?: number;
    exemptWithoutDeduction?: number;
    outOfScope?: number;
    withheldAtSourceRevenue?: number;
    withheldAtSourcePurchase?: number;
    fixedAssetSaleTaxable?: number;
    fixedAssetSaleTaxableVat?: number;
    fixedAssetSaleExempt?: number;
    fixedAssetPurchase?: number;
    fixedAssetPurchaseVat?: number;
    nonResidentTax?: number;
    miscCol1?: number;
    miscCol2?: number;
    miscCol3?: number;
  },
): LebanonVatReturnForm {
  const opt = options || {};
  const taxableRevenueBase = round2(incomeStatement.revenue.total);
  const outputVat = vatFiling.outputVat.net;
  const purchaseBase = round2(incomeStatement.cogs.total);
  const expenseBase = round2(incomeStatement.operatingExpenses.total + incomeStatement.financialExpenses.total);
  const purchaseInputVat = inputVatFromPurchases(vatFiling);
  const expenseInputVat = inputVatFromExpenses(vatFiling, purchaseInputVat);

  const revenueDetail: VatFormRow[] = [
    {
      code: 100,
      labelAr: 'صافي الإيرادات الخاضعة',
      col1: taxableRevenueBase,
      col2: outputVat,
      col3: 'na',
    },
    {
      code: 110,
      labelAr: 'سلفات مقبوضة عن عمليات خاضعة',
      col1: round2(opt.advancesReceived || 0),
      col2: round2(opt.advancesReceivedVat || 0),
      col3: 'na',
    },
    {
      code: 120,
      labelAr: 'صافي الإيرادات الخاضعة المحتسبة ضريبتها مسبقاً لدى المنبع',
      col1: round2(opt.withheldAtSourceRevenue || 0),
      col2: 'na',
      col3: 'na',
    },
    {
      code: 130,
      labelAr: 'صافي الإيرادات المعفاة مع حق الحسم',
      col1: round2(opt.exemptWithDeduction || 0),
      col2: 'na',
      col3: 'na',
    },
    {
      code: 140,
      labelAr: 'صافي الإيرادات المعفاة دون حق الحسم',
      col1: round2(opt.exemptWithoutDeduction || 0),
      col2: 'na',
      col3: 'na',
    },
    {
      code: 150,
      labelAr: 'صافي الإيرادات الخارجة عن نطاق الضريبة',
      col1: round2(opt.outOfScope || 0),
      col2: 'na',
      col3: 'na',
    },
    {
      code: 160,
      labelAr: 'صافي مبيع أصول ثابتة خاضعة',
      col1: round2(opt.fixedAssetSaleTaxable || 0),
      col2: round2(opt.fixedAssetSaleTaxableVat || 0),
      col3: 'na',
    },
    {
      code: 165,
      labelAr: 'صافي مبيع أصول ثابتة غير خاضعة',
      col1: round2(opt.fixedAssetSaleExempt || 0),
      col2: 'na',
      col3: 'na',
    },
    {
      code: 170,
      labelAr: 'ضريبة مستحقة للدفع عن مبالغ مستحقة لغير المقيمين',
      col1: 'na',
      col2: round2(opt.nonResidentTax || 0),
      col3: 'na',
    },
    {
      code: 180,
      labelAr: 'مختلف إشرح:',
      col1: round2(opt.miscCol1 || 0),
      col2: round2(opt.miscCol2 || 0),
      col3: round2(opt.miscCol3 || 0),
    },
  ];

  const revenueTotal: VatFormRow = {
    code: 190,
    labelAr: 'المجموع',
    col1: sumColumn(revenueDetail, 'col1'),
    col2: sumColumn(revenueDetail, 'col2'),
    col3: sumColumn(revenueDetail, 'col3'),
    isTotal: true,
  };

  const purchaseDetail: VatFormRow[] = [
    {
      code: 200,
      labelAr: 'صافي المشتريات (+/-) قيمة التغيير في المخزون',
      col1: purchaseBase,
      col2: 'na',
      col3: purchaseInputVat,
    },
    {
      code: 210,
      labelAr: 'صافي الأعباء',
      col1: expenseBase,
      col2: 'na',
      col3: expenseInputVat,
    },
    {
      code: 220,
      labelAr: 'سلفات مدفوعة عن عمليات خاضعة',
      col1: round2(opt.advancesPaid || 0),
      col2: 'na',
      col3: round2(opt.advancesPaidVat || 0),
    },
    {
      code: 230,
      labelAr: 'صافي مشتريات أصول ثابتة',
      col1: round2(opt.fixedAssetPurchase || 0),
      col2: 'na',
      col3: round2(opt.fixedAssetPurchaseVat || 0),
    },
    {
      code: 240,
      labelAr: 'مبالغ مشتريات محتسبة ضريبتها مسبقاً لدى المنبع',
      col1: round2(opt.withheldAtSourcePurchase || 0),
      col2: 'na',
      col3: 'na',
    },
  ];

  const purchaseTotal: VatFormRow = {
    code: 250,
    labelAr: 'المجموع',
    col1: sumColumn(purchaseDetail, 'col1'),
    col2: 'na',
    col3: sumColumn(purchaseDetail, 'col3'),
    isTotal: true,
  };

  const taxDue = revenueTotal.col2 as number;
  const previousCredit = round2(opt.previousPeriodCredit || 0);
  const deductible = purchaseTotal.col3 as number;
  const netDue = round2(Math.max(0, taxDue - previousCredit - deductible));
  const refundableCarry = round2(Math.max(0, deductible + previousCredit - taxDue));

  const penaltyRows: VatFormRow[] = [
    { code: 360, labelAr: 'غرامة المادة 107 التأخير في تقديم طلب التسجيل من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 361, labelAr: 'غرامة المادة 109 التأخير أو عدم تقديم التصريح الضريبي من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 362, labelAr: 'غرامة المادة 110 التصاريح الضريبية غير الصحيحة من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 363, labelAr: 'غرامة المادة 111 الإغفال عن التصريح بمعلومات من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 364, labelAr: 'غرامة المادة 113 المخالفات المتعلقة بالفواتير البند 1 من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 365, labelAr: 'غرامة المادة 113 المخالفات المتعلقة بالفواتير البند 2 من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 366, labelAr: 'غرامة المادة 114 عدم مسك السجلات والمستندات المحاسبية من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 367, labelAr: 'غرامة المادة 115 عرقلة إجراءات المراقبة الضريبية من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
    { code: 368, labelAr: 'غرامة المادة 150 اصدار فاتورة مخالفة للقانون من قانون الإجراءات الضريبية رقم 44/2008', col1: 0, col2: 'na', col3: 'na' },
  ];

  const penaltiesTotal = sumColumn(penaltyRows, 'col1');
  const totalPayable = round2(netDue + penaltiesTotal);

  const settlement: VatFormRow[] = [
    { code: 300, labelAr: 'الضريبة المستحقة للدفع', col1: taxDue, col2: 'na', col3: 'na', isTotal: false },
    {
      code: 310,
      labelAr: 'تنزيل: الرصيد المدور من الفترة الضريبية السابقة بعد تنزيل المبلغ المطلوب إسترداده في حال وجوده',
      col1: previousCredit,
      col2: 'na',
      col3: 'na',
    },
    { code: 330, labelAr: 'تنزيل: ضريبة قابلة للحسم عن الفترة الحالية', col1: deductible, col2: 'na', col3: 'na' },
    { code: 340, labelAr: 'صافي الضريبة المستحقة للدفع', col1: netDue, col2: 'na', col3: 'na', isTotal: true },
    { code: 350, labelAr: 'رصيد مدور قابل للإسترداد ***', col1: refundableCarry, col2: 'na', col3: 'na' },
    { code: 355, labelAr: 'المبلغ الذي أجري به مقاصة من طلب الإسترداد ق 3-7 خانة 1 (270)', col1: 0, col2: 'na', col3: 'na' },
    ...penaltyRows,
    { code: 370, labelAr: 'إجمالي المتوجب دفعه ****', col1: totalPayable, col2: 'na', col3: 'na', isTotal: true },
  ];

  return {
    startDate: vatFiling.startDate,
    endDate: vatFiling.endDate,
    currency: vatFiling.currency,
    revenues: [...revenueDetail, revenueTotal],
    purchases: [...purchaseDetail, purchaseTotal],
    settlement,
  };
}

export function lebanonVatReturnFormToCsv(form: LebanonVatReturnForm): string {
  const rowToCsv = (section: string, row: VatFormRow) => [
    section,
    String(row.code),
    row.labelAr,
    typeof row.col1 === 'number' ? String(row.col1) : '',
    typeof row.col2 === 'number' ? String(row.col2) : '',
    typeof row.col3 === 'number' ? String(row.col3) : '',
  ];

  const rows: string[][] = [
    ['Lebanon VAT Return', `${form.startDate} to ${form.endDate}`],
    ['Currency', form.currency],
    [],
    ['Section', 'Code', 'Label', 'Col1', 'Col2', 'Col3'],
    ...form.revenues.map((r) => rowToCsv('revenues', r)),
    ...form.purchases.map((r) => rowToCsv('purchases', r)),
    ...form.settlement.map((r) => rowToCsv('settlement', r)),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
