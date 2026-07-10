/** Platform GL bridge — re-exports finance ledger hooks (throws on posting failure). */
export {
  glPostOrderSaleRecognized,
  glPostOrderSaleReversal,
  glPostProductionStart,
  glPostProductionWipComplete,
  glPostProductionComplete,
  glPostProductionReversal,
  glPostPayrollPayment,
  glPostCashCollectionDeposit,
  glPostDeliveryWalletSettlement,
  type PlatformOrderInput,
  type ProductionReversalInput,
} from '../../suba eco sys/finance/beirut-finance-flow-main/src/lib/ledger/glBridge';

export type { OrderCogsLine } from '../../suba eco sys/finance/beirut-finance-flow-main/src/lib/ledger/autoPosting';
