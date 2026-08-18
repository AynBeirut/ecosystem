import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import LebanonVatReturnFormView from '@/components/LebanonVatReturnFormView';
import {
  recalculateLebanonVatForm,
  updateVatFormCell,
  type LebanonVatReturnForm,
} from '@/lib/ledger/lebanonVatReturnForm';
import {
  clearVatFormDraft,
  loadVatFormDraft,
  saveVatFormDraft,
  type VatFormDraftMeta,
} from '@/lib/ledger/lebanonVatFormDraft';
import {
  downloadOfficialMofVatFormExcel,
  downloadOfficialMofVatFormHtml,
  printOfficialMofVatForm,
  type MofVatFormMeta,
} from '@/lib/ledger/lebanonVatReturnFormLayout';

type Props = {
  storeId: string;
  glForm: LebanonVatReturnForm;
  companyName?: string;
  taxId?: string;
  systemGuideEnabled?: boolean;
};

export default function LebanonVatReturnFormPanel({
  storeId,
  glForm,
  companyName,
  taxId,
  systemGuideEnabled,
}: Props) {
  const [form, setForm] = useState<LebanonVatReturnForm>(() => glForm);
  const [meta, setMeta] = useState<VatFormDraftMeta>(() => ({
    companyName: companyName || '',
    taxId: taxId || '',
    miscExplain: '',
  }));

  useEffect(() => {
    const draft = loadVatFormDraft(storeId, glForm.startDate, glForm.endDate);
    if (draft) {
      setForm(recalculateLebanonVatForm(draft.form));
      setMeta(draft.meta);
    } else {
      setForm(glForm);
      setMeta({
        companyName: companyName || '',
        taxId: taxId || '',
        miscExplain: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, glForm.startDate, glForm.endDate]);

  const persistDraft = useCallback(
    (nextForm: LebanonVatReturnForm, nextMeta: VatFormDraftMeta) => {
      saveVatFormDraft(storeId, nextForm.startDate, nextForm.endDate, { form: nextForm, meta: nextMeta });
    },
    [storeId],
  );

  const handleCellChange = useCallback(
    (code: number, col: 'col1' | 'col2' | 'col3', value: number) => {
      setForm((prev) => {
        const next = recalculateLebanonVatForm(updateVatFormCell(prev, code, col, value));
        persistDraft(next, meta);
        return next;
      });
    },
    [meta, persistDraft],
  );

  const handleMetaChange = useCallback(
    (patch: Partial<VatFormDraftMeta>) => {
      setMeta((prev) => {
        const next = { ...prev, ...patch };
        persistDraft(form, next);
        return next;
      });
    },
    [form, persistDraft],
  );

  const fillFromGl = () => {
    setForm(glForm);
    const nextMeta = {
      companyName: meta.companyName || companyName || '',
      taxId: meta.taxId || taxId || '',
      miscExplain: meta.miscExplain,
    };
    setMeta(nextMeta);
    persistDraft(glForm, nextMeta);
    toast.success('تم تعبئة الحقول من دفتر الأستاذ');
  };

  const saveDraft = () => {
    persistDraft(form, meta);
    toast.success('تم حفظ المسودة');
  };

  const clearDraft = () => {
    clearVatFormDraft(storeId, form.startDate, form.endDate);
    setForm(glForm);
    setMeta({ companyName: companyName || '', taxId: taxId || '', miscExplain: '' });
    toast.success('تم مسح المسودة — تمت إعادة التعبئة من GL');
  };

  const exportMeta: MofVatFormMeta = {
    companyName: meta.companyName,
    taxId: meta.taxId,
    miscExplain: meta.miscExplain,
    periodLabel: `${form.startDate} → ${form.endDate}`,
  };

  return (
    <Card>
      <CardHeader className="mof-vat-no-print">
        <CardTitle className="flex items-center gap-2">
          إقرار ضريبة القيمة المضافة
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="About this form"
            title="Lebanon VAT return"
            content={[
              'Official MoF form — edit yellow cells. Use the period filter at the top of Accounting (From / To).',
              'Q1–Q4 shortcuts set a 3-month VAT quarter. Fill from GL, adjust, then Print/PDF.',
            ]}
          />
        </CardTitle>
        <CardDescription>
          نموذج وزارة المالية الرسمي · {form.startDate} → {form.endDate} — use header dates to change period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mof-vat-no-print flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillFromGl}>
            <RefreshCw className="h-4 w-4 mr-1" /> Fill from GL
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={saveDraft}>
            <Save className="h-4 w-4 mr-1" /> Save draft
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => printOfficialMofVatForm(form, exportMeta)}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialMofVatFormHtml(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export HTML
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialMofVatFormExcel(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={clearDraft}>
            Reset
          </Button>
        </div>

        <p className="mof-vat-no-print text-xs text-muted-foreground">
          Yellow cells editable · gray = N/A on official form · totals recalculate automatically.
        </p>

        <LebanonVatReturnFormView form={form} meta={meta} onCellChange={handleCellChange} onMetaChange={handleMetaChange} />
      </CardContent>
    </Card>
  );
}
