import React from 'react';
import ModuleGate from '@/components/ModuleGate';

type CrmAddonGateProps = {
  children: React.ReactNode;
};

/** @deprecated Use ModuleGate with moduleId="crm" — kept for backward compatibility */
const CrmAddonGate: React.FC<CrmAddonGateProps> = ({ children }) => (
  <ModuleGate moduleId="crm">{children}</ModuleGate>
);

export default CrmAddonGate;
