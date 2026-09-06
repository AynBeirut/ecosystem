import React from 'react';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';
import { canManageProducts } from '../../lib/ownerAccess';
import AddEditProductScreen from './AddEditProductScreen';

export default function GatedAddEditProductScreen() {
  return (
    <OwnerOnlyGate title="Products" isAllowed={canManageProducts} denyMessage="Only the store owner can add or edit products.">
      <AddEditProductScreen />
    </OwnerOnlyGate>
  );
}
