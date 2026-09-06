import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmMyClientsScreen from '../crm/CrmMyClientsScreen';

export default function GatedCrmMyClientsScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmMyClientsScreen />
    </MobileModuleGate>
  );
}
