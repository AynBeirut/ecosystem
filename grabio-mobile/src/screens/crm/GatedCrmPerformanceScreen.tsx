import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmPerformanceScreen from './CrmPerformanceScreen';

export default function GatedCrmPerformanceScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmPerformanceScreen />
    </MobileModuleGate>
  );
}
