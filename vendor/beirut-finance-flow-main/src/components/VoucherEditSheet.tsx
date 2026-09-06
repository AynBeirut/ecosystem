import { useEffect, useState } from 'react';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import VoucherEntryPanel from '@/components/VoucherEntryPanel';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount, VoucherLineSettlement } from '@/types/generalLedger';
import type { Invoice, PurchaseOrder } from '@/types/index';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { ComponentProps } from 'react';

type VoucherPostHandler = ComponentProps<typeof VoucherEntryPanel>['onPost'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
  accounts: LedgerAccount[];
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  invoices?: Invoice[];
  purchaseOrders?: PurchaseOrder[];
  paymentOrders?: Array<{ purchaseOrderId?: string; amount?: number }>;
  settlements?: VoucherLineSettlement[];
  mainCurrency?: string;
  fxRateDefault?: number;
  posting: boolean;
  onPost: VoucherPostHandler;
  registerEntries: JournalEntry[];
  registerLines: JournalLine[];
  systemGuideEnabled?: boolean;
  onRegisterPostDraft: (id: string) => void | Promise<void>;
  postingRegisterDraft: boolean;
  onRegisterReverse: (id: string) => void | Promise<void>;
  reversingRegister: boolean;
  prefillEntry: JournalEntry | null;
  prefillLines: JournalLine[];
  onPrefillConsumed: () => void;
  onReversePosted: (entryId: string) => void | Promise<void>;
};

export default function VoucherEditSheet({
  open,
  onOpenChange,
  prefillEntry,
  prefillLines,
  onPrefillConsumed,
  ...panelProps
}: Props) {
  const [snapshot, setSnapshot] = useState<{ entry: JournalEntry; lines: JournalLine[] } | null>(null);

  useEffect(() => {
    if (open && prefillEntry) {
      setSnapshot({ entry: prefillEntry, lines: prefillLines });
    }
  }, [open, prefillEntry, prefillLines]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSnapshot(null);
      onPrefillConsumed();
    }
    onOpenChange(next);
  };

  return (
    <AccountingSideSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit voucher"
      description="Reverse and repost on this page — you stay on the tab you were working on."
      size="form"
      tall
    >
      {snapshot ? (
        <VoucherEntryPanel
          {...panelProps}
          prefillEntry={snapshot.entry}
          prefillLines={snapshot.lines}
          onPrefillConsumed={() => undefined}
        />
      ) : null}
    </AccountingSideSheet>
  );
}
