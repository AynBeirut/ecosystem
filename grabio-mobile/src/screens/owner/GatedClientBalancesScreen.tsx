import React from 'react';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';
import { canViewClientBalances } from '../../lib/ownerAccess';
import ClientBalancesScreen from './ClientBalancesScreen';

export default function GatedClientBalancesScreen() {
  return (
    <OwnerOnlyGate title="Client balances" isAllowed={(role, subRole) => canViewClientBalances(role, subRole)}>
      <ClientBalancesScreen />
    </OwnerOnlyGate>
  );
}
