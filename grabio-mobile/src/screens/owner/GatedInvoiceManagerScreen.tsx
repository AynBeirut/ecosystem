import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import InvoiceFinanceShellScreen from './InvoiceFinanceShellScreen';

/** Opens full standalone Invoice Manager UI inside Grabio — no browser, no tile hub. */
export default function GatedInvoiceManagerScreen() {
  return (
    <MobileModuleGate moduleId="invoice_manager" title="Invoice Manager">
      <InvoiceFinanceShellScreen />
    </MobileModuleGate>
  );
}
