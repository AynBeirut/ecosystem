import React from 'react';
import PurchasesScreen from './PurchasesScreen';
import MobileModuleGate from '../../components/MobileModuleGate';

export default function GatedPurchasesScreen() {
  return (
    <MobileModuleGate moduleId="stock" title="Purchases">
      <PurchasesScreen />
    </MobileModuleGate>
  );
}
