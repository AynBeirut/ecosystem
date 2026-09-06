import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmMyClientsScreen from '../crm/CrmMyClientsScreen';

/** Native Sales CRM — no WebView. */
export default function GatedSalesCrmScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmMyClientsScreen />
    </MobileModuleGate>
  );
}
