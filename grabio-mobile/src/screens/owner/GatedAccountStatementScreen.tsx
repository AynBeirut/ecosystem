import React from 'react';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';
import { canAccessAccounting } from '../../lib/ownerAccess';
import AccountStatementScreen from './AccountStatementScreen';

export default function GatedAccountStatementScreen() {
  return (
    <OwnerOnlyGate title="Account Statement" isAllowed={canAccessAccounting}>
      <AccountStatementScreen />
    </OwnerOnlyGate>
  );
}
