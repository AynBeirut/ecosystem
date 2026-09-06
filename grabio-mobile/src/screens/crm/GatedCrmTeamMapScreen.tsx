import React from 'react';
import MobileModuleGate from '../../components/MobileModuleGate';
import CrmTeamMapScreen from './CrmTeamMapScreen';

export default function GatedCrmTeamMapScreen() {
  return (
    <MobileModuleGate moduleId="crm" title="Sales CRM">
      <CrmTeamMapScreen />
    </MobileModuleGate>
  );
}
