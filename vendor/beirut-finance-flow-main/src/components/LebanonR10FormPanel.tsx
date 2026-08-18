import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import LebanonR10FormView from '@/components/LebanonR10FormView';
import {
  recalculateLebanonR10Form,
  updateR10DualCell,
  updateR10HeaderCount,
  updateR10SingleCell,
  type LebanonR10Form,
} from '@/lib/ledger/lebanonR10Form';
import {
  clearR10FormDraft,
  loadR10FormDraft,
  saveR10FormDraft,
  type R10FormDraftMeta,
} from '@/lib/ledger/lebanonR10FormDraft';
import {
  downloadOfficialMofR10FormExcel,
  downloadOfficialMofR10FormHtml,
  printOfficialMofR10Form,
  type MofR10FormMeta,
} from '@/lib/ledger/lebanonR10FormLayout';

type Props = {
  storeId: string;
  glForm: LebanonR10Form;
  companyName?: string;
  taxId?: string;
  systemGuideEnabled?: boolean;
};

export default function LebanonR10FormPanel({
  storeId,
  glForm,
  companyName,
  taxId,
  systemGuideEnabled,
}: Props) {
  const [form, setForm] = useState<LebanonR10Form>(() => glForm);
  const [meta, setMeta] = useState<R10FormDraftMeta>(() => ({
    companyName: companyName || '',
    taxId: taxId || '',
  }));

  useEffect(() => {
    const draft = loadR10FormDraft(storeId, glForm.startDate, glForm.endDate);
    if (draft) {
      setForm(recalculateLebanonR10Form(draft.form));
      setMeta(draft.meta);
    } else {
      setForm(glForm);
      setMeta({ companyName: companyName || '', taxId: taxId || '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, glForm.startDate, glForm.endDate]);

  const persist = useCallback(
    (nextForm: LebanonR10Form, nextMeta: R10FormDraftMeta) => {
      saveR10FormDraft(storeId, nextForm.startDate, nextForm.endDate, { form: nextForm, meta: nextMeta });
    },
    [storeId],
  );

  const handleDualChange = useCallback(
    (code: number, col: 'board' | 'employees', value: number) => {
      setForm((prev) => {
        const next = recalculateLebanonR10Form(updateR10DualCell(prev, code, col, value));
        persist(next, meta);
        return next;
      });
    },
    [meta, persist],
  );

  const handleSingleChange = useCallback(
    (code: number, value: number) => {
      setForm((prev) => {
        const next = recalculateLebanonR10Form(updateR10SingleCell(prev, code, value));
        persist(next, meta);
        return next;
      });
    },
    [meta, persist],
  );

  const handleHeaderChange = useCallback(
    (code: 70 | 80 | 90, value: number) => {
      setForm((prev) => {
        const next = updateR10HeaderCount(prev, code, value);
        persist(next, meta);
        return next;
      });
    },
    [meta, persist],
  );

  const handleMetaChange = useCallback(
    (patch: Partial<R10FormDraftMeta>) => {
      setMeta((prev) => {
        const next = { ...prev, ...patch };
        persist(form, next);
        return next;
      });
    },
    [form, persist],
  );

  const fillFromGl = () => {
    setForm(glForm);
    const nextMeta = {
      companyName: meta.companyName || companyName || '',
      taxId: meta.taxId || taxId || '',
    };
    setMeta(nextMeta);
    persist(glForm, nextMeta);
    toast.success('تم تعبئة R10 من دفتر الأستاذ');
  };

  const exportMeta: MofR10FormMeta = {
    companyName: meta.companyName,
    taxId: meta.taxId,
    periodLabel: `${form.startDate} → ${form.endDate}`,
  };

  return (
    <Card>
      <CardHeader className="mof-vat-no-print">
        <CardTitle className="flex items-center gap-2">
          نموذج R10 — ضريبة الرواتب والأجور
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="About R10"
            title="Lebanon R10"
            content={[
              'Official MoF salary withholding form. Use the From/To dates in the Accounting header.',
              'Yellow cells are editable; totals (120, 160, 180, 260, 270, 300) recalculate automatically.',
              'Fill from GL pulls payroll expense (631) and withholding (213) for the period.',
            ]}
          />
        </CardTitle>
        <CardDescription>
          {form.startDate} → {form.endDate} · period filter at top of Accounting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mof-vat-no-print flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillFromGl}>
            <RefreshCw className="h-4 w-4 mr-1" /> Fill from GL
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              persist(form, meta);
              toast.success('تم حفظ المسودة');
            }}
          >
            <Save className="h-4 w-4 mr-1" /> Save draft
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => printOfficialMofR10Form(form, exportMeta)}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialMofR10FormHtml(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export HTML
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialMofR10FormExcel(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              clearR10FormDraft(storeId, form.startDate, form.endDate);
              setForm(glForm);
              setMeta({ companyName: companyName || '', taxId: taxId || '' });
              toast.success('Reset to GL');
            }}
          >
            Reset
          </Button>
        </div>

        <LebanonR10FormView
          form={form}
          meta={meta}
          onDualChange={handleDualChange}
          onSingleChange={handleSingleChange}
          onHeaderChange={handleHeaderChange}
          onMetaChange={handleMetaChange}
        />
      </CardContent>
    </Card>
  );
}
