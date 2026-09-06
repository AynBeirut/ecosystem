import React from 'react';
import OwnerOnlyGate from '../../components/OwnerOnlyGate';
import ExpensesScreen from './ExpensesScreen';

export default function GatedExpensesScreen() {
  return (
    <OwnerOnlyGate title="Expenses">
      <ExpensesScreen />
    </OwnerOnlyGate>
  );
}
