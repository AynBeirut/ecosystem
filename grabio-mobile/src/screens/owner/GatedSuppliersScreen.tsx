import React from 'react';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';
import SuppliersScreen from './SuppliersScreen';

export default function GatedSuppliersScreen() {
  return (
    <OwnerOnlyGate title="Suppliers">
      <SuppliersScreen />
    </OwnerOnlyGate>
  );
}
