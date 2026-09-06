import React from 'react';
import PurchasesScreen from './PurchasesScreen';
import MobileModuleGate from '../../components/MobileModuleGate';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';

export default function GatedPurchasesScreen() {
  return (
    <MobileModuleGate moduleId="stock" title="Purchases">
      <OwnerOnlyGate title="Purchases">
        <PurchasesScreen />
      </OwnerOnlyGate>
    </MobileModuleGate>
  );
}
