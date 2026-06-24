import React from 'react';
import PurchasesScreen from '../screens/owner/PurchasesScreen';
import MobileModuleGate from '../components/MobileModuleGate';

export default function GatedPurchasesScreen() {
  return (
    <MobileModuleGate moduleId="stock" title="Purchases">
      <PurchasesScreen />
    </MobileModuleGate>
  );
}
