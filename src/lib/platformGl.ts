/** Platform GL bridge — re-exports finance ledger hooks (throws on posting failure). */
import '@/embed/wireFinanceOnLoad';

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
  glPostPurchaseReceived,
  type PlatformOrderInput,
  type ProductionReversalInput,
} from '../../vendor/beirut-finance-flow-main/src/lib/ledger/glBridge';

export type { OrderCogsLine } from '../../vendor/beirut-finance-flow-main/src/lib/ledger/autoPosting';
