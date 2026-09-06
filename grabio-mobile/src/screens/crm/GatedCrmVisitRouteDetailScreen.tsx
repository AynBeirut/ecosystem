import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmVisitRouteDetailScreen from './CrmVisitRouteDetailScreen';

export default function GatedCrmVisitRouteDetailScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmVisitRouteDetailScreen />
    </MobileModuleGate>
  );
}
