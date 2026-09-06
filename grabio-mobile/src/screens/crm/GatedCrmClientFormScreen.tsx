import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmClientFormScreen from './CrmClientFormScreen';

export default function GatedCrmClientFormScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmClientFormScreen />
    </MobileModuleGate>
  );
}
