import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmStoreAreasScreen from './CrmStoreAreasScreen';

export default function GatedCrmStoreAreasScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmStoreAreasScreen />
    </MobileModuleGate>
  );
}
