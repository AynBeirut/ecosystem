import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmVisitRouteFormScreen from './CrmVisitRouteFormScreen';

export default function GatedCrmVisitRouteFormScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmVisitRouteFormScreen />
    </MobileModuleGate>
  );
}
