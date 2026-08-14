import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INVOICE_MANAGER_MODULE_OPTIONS } from '@/pages/admin/invoice-manager/invoiceManagerModuleTabs';
import type { InvoiceManagerModule } from '@/pages/admin/invoice-manager/invoiceManagerModuleTabs';

type Props = {
  activeModule: InvoiceManagerModule;
  onModuleChange: (module: InvoiceManagerModule) => void;
};

export default function InvoiceManagerNavBar({ activeModule, onModuleChange }: Props) {
  const activeLabel = useMemo(
    () => INVOICE_MANAGER_MODULE_OPTIONS.find((item) => item.value === activeModule)?.label ?? 'Invoices',
    [activeModule],
  );

  return (
    <div className="finance-compact-nav flex flex-wrap items-center gap-2">
      <Link
        to="/admin/dashboard"
        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Dashboard
      </Link>

      <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Invoice Manager</span>

      <Select value={activeModule} onValueChange={(value) => onModuleChange(value as InvoiceManagerModule)}>
        <SelectTrigger className="finance-compact-nav__select h-8 min-w-[10rem] flex-1 text-xs sm:max-w-xs">
          <SelectValue>{activeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {INVOICE_MANAGER_MODULE_OPTIONS.map((item) => (
            <SelectItem key={item.value} value={item.value} className="text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
