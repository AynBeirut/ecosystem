import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  mapGrabioInvoiceTemplateToFinance,
  mapFinanceInvoiceTemplateToGrabio,
  type FinanceInvoiceTemplate,
} from '../../../lib/invoiceTemplateMap';
import {
  readFinanceDocumentSettings,
  type FinanceDocumentSettings,
} from '../../../lib/financeDocumentSettingsCore';
import { generateFinanceDocumentHTML } from '../../../lib/financeDocumentHtml';
import type { StoreProfile } from '../../../types/storeProfile';
import { NIPCO_TEMPLATE_LOCK_MESSAGE } from '../../../lib/nipcoInvoiceTemplateLock';
import {
  INVOICE_DUE_DAY_OPTIONS,
  FONT_SCALE_OPTIONS,
  PDF_LAYOUT_TEMPLATES,
  normalizeDocumentLayout,
  type DocumentLineWeight,
} from '../../../lib/invoiceDocumentSetupConfig';
import { cn } from '@/lib/utils';

const PREVIEW_PAGE_WIDTH = 820;

function ScaledInvoicePreview({ src }: { src: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pageH, setPageH] = useState(1120);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = box.w > 0 && box.h > 0 ? Math.min(box.w / PREVIEW_PAGE_WIDTH, box.h / pageH) : 0.4;
  const left = Math.max(0, (box.w - PREVIEW_PAGE_WIDTH * scale) / 2);
  const top = Math.max(0, (box.h - pageH * scale) / 2);

  return (
    <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden bg-neutral-100">
      {src ? (
        <iframe
          ref={frameRef}
          title="Invoice mini preview"
          src={src}
          scrolling="no"
          onLoad={() => {
            const doc = frameRef.current?.contentDocument;
            const next = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight || 0;
            if (next > 200) setPageH(next);
          }}
          className="pointer-events-none absolute border-0 bg-white"
          style={{
            width: PREVIEW_PAGE_WIDTH,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            left,
            top,
          }}
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">Load store profile to preview.</p>
      )}
    </div>
  );
}

const SAMPLE_PREVIEW_DOC = {
  invoiceNumber: 'INV-1001',
  clientName: 'Sample Client',
  date: new Date().toISOString(),
  items: [
    {
      description: 'Sample product',
      productName: 'Sample product',
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
    },
    {
      description: 'Sample service',
      productName: 'Sample service',
      quantity: 1,
      unitPrice: 25,
      subtotal: 25,
    },
  ],
  subtotal: 125,
  tax: 0,
  total: 125,
  currency: 'USD',
  notes: '',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
      {children}
    </p>
  );
}

type DraftFields = {
  documentLogo: string;
  signature: string;
  signatoryName: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  country: string;
  taxId: string;
  invoiceTemplate: FinanceInvoiceTemplate;
  documentLayout: string;
  showCompanyNameOnPdf: boolean;
  primaryColor: string;
  secondaryColor: string;
  lineWeight: DocumentLineWeight;
  lineStyle: 'solid' | 'double' | 'dashed' | 'none';
  footerNote: string;
  bankDetails: string;
  invoiceDueDays: number;
  contactPlacement: 'hero' | 'footer';
  templateNumber: number;
  colorMode: 'colored' | 'bw';
  fontScale: string;
  borderColor: string;
  headerSpace: number;
  orgAlign: 'left' | 'center' | 'right';
  logoAlign: 'left' | 'center' | 'right';
};

function draftProfileForPreview(base: StoreProfile | null, fields: DraftFields): StoreProfile | null {
  if (!base) return null;
  const grabioTemplate = mapFinanceInvoiceTemplateToGrabio(fields.invoiceTemplate);
  return {
    ...base,
    invoiceTemplate: grabioTemplate,
    financeDocumentSettings: {
      ...(base.financeDocumentSettings ?? {}),
      documentLogo: fields.documentLogo || undefined,
      signature: fields.signature || undefined,
      documentSignatoryName: fields.signatoryName.trim() || undefined,
      documentCompanyName: fields.companyName.trim() || undefined,
      documentAddress: fields.address.trim() || undefined,
      documentPhone: fields.phone.trim() || undefined,
      documentEmail: fields.email.trim() || undefined,
      documentWebsite: fields.website.trim() || undefined,
      documentCountry: fields.country.trim() || undefined,
      documentTaxId: fields.taxId.trim() || undefined,
      invoiceTemplate: fields.invoiceTemplate,
      documentLayout: fields.documentLayout || 'standard',
      documentShowCompanyName: fields.showCompanyNameOnPdf,
      primaryColor: fields.primaryColor || undefined,
      secondaryColor: fields.secondaryColor || undefined,
      documentLineWeight: fields.lineWeight,
      documentLineStyle: fields.lineStyle,
      documentFooterNote: fields.footerNote.trim() || undefined,
      documentBankDetails: fields.bankDetails.trim() || undefined,
      invoiceDueDays: fields.invoiceDueDays,
      documentContactPlacement: fields.contactPlacement,
      documentTemplateNumber: fields.templateNumber,
      documentColorMode: fields.colorMode,
      documentFontScale: fields.fontScale,
      documentBorderColor: fields.borderColor || undefined,
      documentHeaderSpace: fields.headerSpace,
      documentOrgAlign: fields.orgAlign,
      documentLogoAlign: fields.logoAlign,
    },
  };
}

export type InvoiceDocumentSetupContentProps = {
  profile: StoreProfile | null;
  storeId: string | null;
  loading: boolean;
  nipcoLocked: boolean;
  saving: boolean;
  onSave: (patch: Partial<FinanceDocumentSettings>) => Promise<void>;
  backTo?: string;
  backLabel?: string;
  storeProfileLink?: string;
};

export default function InvoiceDocumentSetupContent({
  profile,
  storeId,
  loading,
  nipcoLocked,
  saving,
  onSave,
  backTo,
  backLabel = 'Back',
  storeProfileLink = '/admin/profile',
}: InvoiceDocumentSetupContentProps) {
  const [documentLogo, setDocumentLogo] = useState('');
  const [signature, setSignature] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [taxId, setTaxId] = useState('');
  const [invoiceTemplate, setInvoiceTemplate] = useState<FinanceInvoiceTemplate>('modern');
  const [documentLayout, setDocumentLayout] = useState('standard');
  const [showCompanyNameOnPdf, setShowCompanyNameOnPdf] = useState(true);
  const [primaryColor, setPrimaryColor] = useState('#3182CE');
  const [secondaryColor, setSecondaryColor] = useState('#2B6CB0');
  const [lineWeight, setLineWeight] = useState<DocumentLineWeight>('regular');
  const [lineStyle, setLineStyle] = useState<'solid' | 'double' | 'dashed' | 'none'>('solid');
  const [footerNote, setFooterNote] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [invoiceDueDays, setInvoiceDueDays] = useState(30);
  const [contactPlacement, setContactPlacement] = useState<'hero' | 'footer'>('hero');
  const [templateNumber, setTemplateNumber] = useState(2);
  const [colorMode, setColorMode] = useState<'colored' | 'bw'>('colored');
  const [fontScale, setFontScale] = useState('m');
  const [borderColor, setBorderColor] = useState('#E8752B');
  const [headerSpace, setHeaderSpace] = useState(16);
  const [orgAlign, setOrgAlign] = useState<'left' | 'center' | 'right'>('left');
  const [logoAlign, setLogoAlign] = useState<'left' | 'center' | 'right'>('left');
  const [screen, setScreen] = useState<'company' | 'layout'>('layout');
  const [designTab, setDesignTab] = useState<'templates' | 'size' | 'border' | 'header'>('templates');
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  const closePreviewFullscreen = useCallback(() => setPreviewFullscreen(false), []);

  useEffect(() => {
    if (!previewFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreviewFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFullscreen, closePreviewFullscreen]);

  useEffect(() => {
    if (!profile) return;
    const doc = readFinanceDocumentSettings(profile);
    setDocumentLogo(doc.documentLogo || '');
    setSignature(doc.signature || '');
    setSignatoryName(doc.documentSignatoryName || '');
    setCompanyName(doc.documentCompanyName || '');
    setAddress(doc.documentAddress || '');
    setPhone(doc.documentPhone || '');
    setEmail(doc.documentEmail || '');
    setWebsite(doc.documentWebsite || '');
    setCountry(doc.documentCountry || '');
    setTaxId(doc.documentTaxId || '');
    setInvoiceTemplate(mapGrabioInvoiceTemplateToFinance(profile.invoiceTemplate, doc.invoiceTemplate));
    setDocumentLayout(normalizeDocumentLayout(doc.documentLayout || 'standard'));
    setShowCompanyNameOnPdf(doc.documentShowCompanyName !== false);
    setPrimaryColor(doc.primaryColor || '#3182CE');
    setSecondaryColor(doc.secondaryColor || '#2B6CB0');
    setLineWeight((doc.documentLineWeight as DocumentLineWeight) || 'regular');
    setLineStyle(
      doc.documentLineStyle === 'double' || doc.documentLineStyle === 'dashed' || doc.documentLineStyle === 'none'
        ? doc.documentLineStyle
        : 'solid',
    );
    setFooterNote(doc.documentFooterNote?.trim() || doc.documentFooter?.trim() || '');
    setBankDetails(doc.documentBankDetails?.trim() || '');
    setInvoiceDueDays(
      typeof doc.invoiceDueDays === 'number' && doc.invoiceDueDays > 0 ? doc.invoiceDueDays : 30,
    );
    setContactPlacement(doc.documentContactPlacement === 'footer' ? 'footer' : 'hero');
    setTemplateNumber(
      doc.documentTemplateNumber && doc.documentTemplateNumber >= 1 && doc.documentTemplateNumber <= 10
        ? doc.documentTemplateNumber
        : 2,
    );
    setColorMode(doc.documentColorMode === 'bw' ? 'bw' : 'colored');
    setFontScale(doc.documentFontScale || 'm');
    setBorderColor(doc.documentBorderColor || doc.primaryColor || '#E8752B');
    setHeaderSpace(typeof doc.documentHeaderSpace === 'number' ? doc.documentHeaderSpace : 16);
    setOrgAlign(doc.documentOrgAlign === 'center' || doc.documentOrgAlign === 'right' ? doc.documentOrgAlign : 'left');
    setLogoAlign(doc.documentLogoAlign === 'center' || doc.documentLogoAlign === 'right' ? doc.documentLogoAlign : 'left');
  }, [profile]);

  const formFields = useMemo(
    (): DraftFields => ({
      documentLogo,
      signature,
      signatoryName,
      companyName,
      address,
      phone,
      email,
      website,
      country,
      taxId,
      invoiceTemplate,
      documentLayout,
      showCompanyNameOnPdf,
      primaryColor,
      secondaryColor,
      lineWeight,
      lineStyle,
      footerNote,
      bankDetails,
      invoiceDueDays,
      contactPlacement,
      templateNumber,
      colorMode,
      fontScale,
      borderColor,
      headerSpace,
      orgAlign,
      logoAlign,
    }),
    [
      documentLogo,
      signature,
      signatoryName,
      companyName,
      address,
      phone,
      email,
      website,
      country,
      taxId,
      invoiceTemplate,
      documentLayout,
      showCompanyNameOnPdf,
      primaryColor,
      secondaryColor,
      lineWeight,
      lineStyle,
      footerNote,
      bankDetails,
      invoiceDueDays,
      contactPlacement,
      templateNumber,
      colorMode,
      fontScale,
      borderColor,
      headerSpace,
      orgAlign,
      logoAlign,
    ],
  );

  const previewHtml = useMemo(() => {
    const draft = draftProfileForPreview(profile, formFields);
    if (!draft) return '';
    try {
      const notes = footerNote.trim() || SAMPLE_PREVIEW_DOC.notes;
      return generateFinanceDocumentHTML(
        'invoice',
        { ...SAMPLE_PREVIEW_DOC, notes },
        draft,
        (amount) => `USD ${amount.toFixed(2)}`,
      );
    } catch (err) {
      console.error('[InvoiceDocumentSetup] preview HTML failed', err);
      return '';
    }
  }, [profile, formFields, footerNote]);

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewHtml) {
      setPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(new Blob([previewHtml], { type: 'text/html;charset=utf-8' }));
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [previewHtml]);

  const openPreviewInNewTab = useCallback(() => {
    if (!previewHtml) return false;
    try {
      const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank');
      if (!opened) {
        URL.revokeObjectURL(url);
        return false;
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return true;
    } catch {
      return false;
    }
  }, [previewHtml]);

  const readImageFile = (file: File, setter: (v: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => setter((e.target?.result as string) || '');
    reader.readAsDataURL(file);
  };

  const applyColorTheme = (primary: string, secondary: string) => {
    setPrimaryColor(primary);
    setSecondaryColor(secondary);
  };

  const handleSave = async () => {
    await onSave({
      documentLogo: documentLogo || undefined,
      signature: signature || undefined,
      documentSignatoryName: signatoryName.trim() || undefined,
      documentCompanyName: companyName.trim() || undefined,
      documentAddress: address.trim() || undefined,
      documentPhone: phone.trim() || undefined,
      documentEmail: email.trim() || undefined,
      documentWebsite: website.trim() || undefined,
      documentCountry: country.trim() || undefined,
      documentTaxId: taxId.trim() || undefined,
      invoiceTemplate,
      documentLayout: documentLayout || 'standard',
      documentShowCompanyName: showCompanyNameOnPdf,
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      documentLineWeight: lineWeight,
      documentLineStyle: lineStyle,
      documentFooterNote: footerNote.trim() || undefined,
      documentBankDetails: bankDetails.trim() || undefined,
      invoiceDueDays,
      documentContactPlacement: contactPlacement,
      documentTemplateNumber: templateNumber,
      documentColorMode: colorMode,
      documentFontScale: fontScale,
      documentBorderColor: borderColor || undefined,
      documentHeaderSpace: headerSpace,
      documentOrgAlign: orgAlign,
      documentLogoAlign: logoAlign,
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading document settings…</p>;
  }

  const layoutScreen = (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[480px] flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {backTo ? (
            <Link to={backTo} className="text-sm font-medium text-[var(--finance-accent,#38B2AC)] hover:underline">
              ← {backLabel}
            </Link>
          ) : null}
          <h1 className="text-lg font-bold text-foreground">Live preview</h1>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
            disabled={!previewHtml}
            onClick={() => {
              if (!openPreviewInNewTab()) setPreviewFullscreen(true);
            }}
          >
            <Eye className="mr-1 h-4 w-4" />
            Full PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => setScreen('company')}
          >
            Company details
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[var(--finance-accent,#38B2AC)] hover:opacity-90"
            disabled={saving || !storeId || nipcoLocked}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {nipcoLocked ? (
        <p className="shrink-0 text-sm text-blue-900 dark:text-blue-100">{NIPCO_TEMPLATE_LOCK_MESSAGE}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md">
        <div className="flex shrink-0 gap-1 border-b border-border p-2">
          {([
            ['templates', 'Templates'],
            ['size', 'Overall size'],
            ['border', 'Border'],
            ['header', 'Header'],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={designTab === id ? 'default' : 'ghost'}
              className={designTab === id ? 'bg-[var(--finance-accent,#38B2AC)] hover:opacity-90' : ''}
              onClick={() => setDesignTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <ScaledInvoicePreview src={previewBlobUrl} />
        <div className="shrink-0 border-t border-border p-3">
          {designTab === 'templates' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Layout only. Color works on every template.</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PDF_LAYOUT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={nipcoLocked}
                    onClick={() => setTemplateNumber(tpl.id)}
                    className={cn(
                      'w-[148px] shrink-0 rounded-lg border-2 p-2 text-left',
                      templateNumber === tpl.id ? 'border-[var(--finance-accent,#38B2AC)] bg-[var(--finance-accent,#38B2AC)]/10' : 'border-border',
                    )}
                  >
                    <span className="text-sm font-semibold">{tpl.label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{tpl.hint}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="accentColor">Accent color</Label>
                <Input id="accentColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={nipcoLocked} className="h-9 w-14 p-1" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={nipcoLocked} className="h-9 max-w-[110px]" />
                <Button type="button" size="sm" variant={colorMode === 'colored' ? 'default' : 'outline'} className={colorMode === 'colored' ? 'bg-[var(--finance-accent,#38B2AC)]' : ''} onClick={() => setColorMode('colored')} disabled={nipcoLocked}>Colored</Button>
                <Button type="button" size="sm" variant={colorMode === 'bw' ? 'default' : 'outline'} onClick={() => setColorMode('bw')} disabled={nipcoLocked}>B/W</Button>
              </div>
            </div>
          ) : null}
          {designTab === 'size' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall size</p>
              {FONT_SCALE_OPTIONS.map((size) => (
                <Button key={size} type="button" size="sm" variant={fontScale === size ? 'default' : 'outline'} className={fontScale === size ? 'bg-[var(--finance-accent,#38B2AC)]' : ''} onClick={() => setFontScale(size)} disabled={nipcoLocked}>{size.toUpperCase()}</Button>
              ))}
            </div>
          ) : null}
          {designTab === 'border' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="borderColor">Border color</Label>
              <Input id="borderColor" type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} disabled={nipcoLocked} className="h-9 w-14 p-1" />
              <Input value={borderColor} onChange={(e) => setBorderColor(e.target.value)} disabled={nipcoLocked} className="h-9 max-w-[110px]" />
            </div>
          ) : null}
          {designTab === 'header' ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[180px] flex-1">
                <Label htmlFor="headerSpace">Space from top</Label>
                <Input id="headerSpace" type="range" min={0} max={64} value={headerSpace} onChange={(e) => setHeaderSpace(Number(e.target.value))} disabled={nipcoLocked} />
              </div>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <Button key={`org-${align}`} type="button" size="sm" variant={orgAlign === align ? 'default' : 'outline'} onClick={() => setOrgAlign(align)} disabled={nipcoLocked}>Org {align}</Button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <Button key={`logo-${align}`} type="button" size="sm" variant={logoAlign === align ? 'default' : 'outline'} onClick={() => setLogoAlign(align)} disabled={nipcoLocked}>Logo {align}</Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className={screen === 'layout' ? '' : 'mx-auto max-w-3xl space-y-6 pb-24'}>
      {screen === 'layout' ? layoutScreen : null}
      {screen === 'company' ? (
      <>
      {backTo ? (
        <Link
          to={backTo}
          className="text-sm font-medium text-[var(--finance-accent,#38B2AC)] hover:underline inline-flex items-center gap-1"
        >
          ← {backLabel}
        </Link>
      ) : null}

      <div className="finance-page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Company on documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PDF branding only — not your web shop.{' '}
            <Link to={storeProfileLink} className="text-[var(--finance-accent,#38B2AC)] hover:underline">
              Store profile
            </Link>{' '}
            is separate.
          </p>
        </div>
        <Button type="button" className="bg-[var(--finance-accent,#38B2AC)] hover:opacity-90" onClick={() => setScreen('layout')}>
          Next: live preview
        </Button>
      </div>

      {nipcoLocked ? (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
          <CardContent className="pt-4 text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium">Production template locked</p>
            <p className="mt-1 opacity-90">{NIPCO_TEMPLATE_LOCK_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : null}


      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-4">
          <SectionTitle>Company on documents</SectionTitle>
          <div className="space-y-2">
            <Label htmlFor="documentCompanyName">Business name</Label>
            <Input
              id="documentCompanyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={profile?.name || 'Leave blank to use store name'}
              disabled={nipcoLocked || !showCompanyNameOnPdf}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="documentShowCompanyName">Show business name on invoice</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Turn off if your logo already shows the name.</p>
            </div>
            <Switch
              id="documentShowCompanyName"
              checked={showCompanyNameOnPdf}
              onCheckedChange={setShowCompanyNameOnPdf}
              disabled={nipcoLocked}
            />
          </div>
          <div className="space-y-2">
            <Label>Address and website</Label>
            <p className="text-xs text-muted-foreground">Show these in one place only.</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={contactPlacement === 'hero' ? 'default' : 'outline'} className={contactPlacement === 'hero' ? 'bg-[var(--finance-accent,#38B2AC)] hover:opacity-90' : ''} disabled={nipcoLocked} onClick={() => setContactPlacement('hero')}>Hero</Button>
              <Button type="button" size="sm" variant={contactPlacement === 'footer' ? 'default' : 'outline'} className={contactPlacement === 'footer' ? 'bg-[var(--finance-accent,#38B2AC)] hover:opacity-90' : ''} disabled={nipcoLocked} onClick={() => setContactPlacement('footer')}>Footer</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentAddress">Address</Label>
            <Textarea id="documentAddress" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} disabled={nipcoLocked} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="documentEmail">Email</Label>
              <Input id="documentEmail" value={email} onChange={(e) => setEmail(e.target.value)} disabled={nipcoLocked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentWebsite">Website / domain</Label>
              <Input id="documentWebsite" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={nipcoLocked} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="documentPhone">Phone</Label>
              <Input id="documentPhone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={nipcoLocked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentTaxId">Tax ID</Label>
              <Input id="documentTaxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={nipcoLocked} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentCountry">Country</Label>
            <Input id="documentCountry" value={country} onChange={(e) => setCountry(e.target.value)} disabled={nipcoLocked} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-4">
          <SectionTitle>Branding</SectionTitle>
          <div className="space-y-2">
            <Label>Company logo</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {documentLogo ? (
                <img
                  src={documentLogo}
                  alt="Logo"
                  className="h-14 max-w-[220px] rounded-lg border border-border bg-white object-contain p-2"
                />
              ) : (
                <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  disabled={nipcoLocked}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readImageFile(f, setDocumentLogo);
                  }}
                />
                {documentLogo ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDocumentLogo('')} disabled={nipcoLocked}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
            <div className="space-y-2">
            <Label htmlFor="signatoryName">Name under signature</Label>
            <Input
              id="signatoryName"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              placeholder="Person who signs the document"
              disabled={nipcoLocked}
            />
          </div>
          <div className="space-y-2">
            <Label>Signature</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {signature ? (
                <img src={signature} alt="Signature" className="h-12 max-w-[180px] object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Optional — shown on PDF exports</span>
              )}
              <div className="flex flex-wrap gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  disabled={nipcoLocked}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readImageFile(f, setSignature);
                  }}
                />
                {signature ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setSignature('')} disabled={nipcoLocked}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-4">
          <SectionTitle>Payment terms</SectionTitle>
          <p className="text-xs text-muted-foreground">Unpaid invoices are due this many days after the invoice date.</p>
          <div className="flex flex-wrap gap-2">
            {INVOICE_DUE_DAY_OPTIONS.map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={invoiceDueDays === days ? 'default' : 'outline'}
                className={invoiceDueDays === days ? 'bg-[var(--finance-accent,#38B2AC)] hover:opacity-90' : ''}
                disabled={nipcoLocked}
                onClick={() => setInvoiceDueDays(days)}
              >
                {days} days
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoiceDueDaysCustom">Custom due days</Label>
            <Input
              id="invoiceDueDaysCustom"
              type="number"
              min={1}
              max={365}
              value={invoiceDueDays}
              onChange={(e) => setInvoiceDueDays(Math.max(1, Number(e.target.value) || 30))}
              disabled={nipcoLocked}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-2">
          <SectionTitle>Footer</SectionTitle>
          <Label htmlFor="footerNote">Footer note (optional)</Label>
          <Textarea
            id="footerNote"
            rows={3}
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder="Payment terms or thank-you message. Leave empty to hide."
            disabled={nipcoLocked}
          />
          <Label htmlFor="bankDetails">Bank details (optional)</Label>
          <Textarea
            id="bankDetails"
            rows={3}
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            placeholder="Account name, IBAN, bank. Leave empty to hide."
            disabled={nipcoLocked}
          />
          <p className="text-xs text-muted-foreground">Shown at the bottom only when you fill them in.</p>
        </CardContent>
      </Card>

      <Button
        type="button"
        className="w-full h-11 bg-[var(--finance-accent,#38B2AC)] hover:opacity-90 text-base font-semibold"
        disabled={saving || !storeId || nipcoLocked}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save template settings'}
      </Button>
      </>
      ) : null}

      {previewFullscreen && previewBlobUrl ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 bg-card">
            <p className="text-sm font-medium text-foreground">Invoice PDF preview</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openPreviewInNewTab()}>
                Open in new tab
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={closePreviewFullscreen} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-neutral-100 dark:bg-neutral-900 p-2 md:p-4">
            <iframe title="Full preview" src={previewBlobUrl} className="h-full w-full rounded-md border bg-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
