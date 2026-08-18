import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import LebanonCnss190AFormView from '@/components/LebanonCnss190AFormView';
import {
  recalculateLebanonCnss190AForm,
  updateCnssBranchField,
  updateCnssFormMeta,
  type CnssBranchKey,
  type CnssBranchRow,
  type LebanonCnss190AForm,
} from '@/lib/ledger/lebanonCnss190AForm';
import {
  clearCnss190AFormDraft,
  loadCnss190AFormDraft,
  saveCnss190AFormDraft,
  type Cnss190AFormDraftMeta,
} from '@/lib/ledger/lebanonCnss190AFormDraft';
import {
  downloadOfficialCnss190AFormExcel,
  downloadOfficialCnss190AFormHtml,
  printOfficialCnss190AForm,
  type Cnss190AFormMeta,
} from '@/lib/ledger/lebanonCnss190AFormLayout';

type Props = {
  storeId: string;
  glForm: LebanonCnss190AForm;
  companyName?: string;
  companyNumber?: string;
  systemGuideEnabled?: boolean;
};

export default function LebanonCnss190AFormPanel({
  storeId,
  glForm,
  companyName,
  companyNumber,
  systemGuideEnabled,
}: Props) {
  const [form, setForm] = useState<LebanonCnss190AForm>(() => glForm);
  const [meta, setMeta] = useState<Cnss190AFormDraftMeta>(() => ({
    companyName: companyName || glForm.companyName || '',
    companyNumber: companyNumber || glForm.companyNumber || '',
  }));

  useEffect(() => {
    const draft = loadCnss190AFormDraft(storeId, glForm.startDate, glForm.endDate);
    if (draft) {
      setForm(recalculateLebanonCnss190AForm(draft.form));
      setMeta(draft.meta);
    } else {
      setForm(glForm);
      setMeta({
        companyName: companyName || glForm.companyName || '',
        companyNumber: companyNumber || glForm.companyNumber || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, glForm.startDate, glForm.endDate]);

  const persist = useCallback(
    (nextForm: LebanonCnss190AForm, nextMeta: Cnss190AFormDraftMeta) => {
      saveCnss190AFormDraft(storeId, nextForm.startDate, nextForm.endDate, {
        form: nextForm,
        meta: nextMeta,
      });
    },
    [storeId],
  );

  const handleBranchChange = useCallback(
    (
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
    ) => {
      setForm((prev) => {
        const next = recalculateLebanonCnss190AForm(updateCnssBranchField(prev, key, field, value));
        persist(next, meta);
        return next;
      });
    },
    [meta, persist],
  );

  const handleFormChange = useCallback(
    (patch: Partial<LebanonCnss190AForm>) => {
      setForm((prev) => {
        const next = recalculateLebanonCnss190AForm(updateCnssFormMeta(prev, patch));
        persist(next, meta);
        return next;
      });
    },
    [meta, persist],
  );

  const handleMetaChange = useCallback(
    (patch: Partial<Cnss190AFormDraftMeta>) => {
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
      companyNumber: meta.companyNumber || companyNumber || '',
    };
    setMeta(nextMeta);
    persist(glForm, nextMeta);
    toast.success('تم تعبئة CNSS 190A من دفتر الأستاذ');
  };

  const exportMeta: Cnss190AFormMeta = {
    companyName: meta.companyName,
    companyNumber: meta.companyNumber,
    periodLabel: form.periodLabel || `${form.startDate} → ${form.endDate}`,
  };

  return (
    <Card>
      <CardHeader className="mof-vat-no-print">
        <CardTitle className="flex items-center gap-2">
          CNSS 190A — جدول الإشتراكات المستحقة
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="About CNSS 190A"
            title="CNSS employer declaration"
            content={[
              'Official NSSF form CNSS 190A from cnss.gov.lb (Financial Directorate).',
              'Three branches: sickness 9%, end-of-service 8.5%, family 6%. Delay penalty = contributions × days / 2000.',
              'Fill from GL pulls payroll wages (631) and employer CNSS expense (602) for the Accounting period.',
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
          <Button type="button" variant="default" size="sm" onClick={() => printOfficialCnss190AForm(form, exportMeta)}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialCnss190AFormHtml(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export HTML
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOfficialCnss190AFormExcel(form, exportMeta)}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              clearCnss190AFormDraft(storeId, form.startDate, form.endDate);
              setForm(glForm);
              setMeta({
                companyName: companyName || '',
                companyNumber: companyNumber || '',
              });
              toast.success('Reset to GL');
            }}
          >
            Reset
          </Button>
        </div>

        <LebanonCnss190AFormView
          form={form}
          meta={meta}
          onBranchChange={handleBranchChange}
          onFormChange={handleFormChange}
          onMetaChange={handleMetaChange}
        />
      </CardContent>
    </Card>
  );
}
