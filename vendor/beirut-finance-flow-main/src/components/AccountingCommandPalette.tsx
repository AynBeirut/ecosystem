import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { JournalEntry, LedgerAccount, PcgClientAccount } from "@/types/generalLedger";
import { buildClientByGrabioMap, formatGlAccountReference } from "@/lib/ledger/grabioToPcgMap";

export type AccountingPaletteTab = {
  value: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: AccountingPaletteTab[];
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  isLebaneseCoa: boolean;
  pcgClientAccounts: PcgClientAccount[];
  onSelectTab: (tab: string) => void;
  onSelectAccount: (accountId: string, label: string) => void;
  onSelectEntry: (entryId: string) => void;
};

export default function AccountingCommandPalette({
  open,
  onOpenChange,
  tabs,
  accounts,
  entries,
  isLebaneseCoa,
  pcgClientAccounts,
  onSelectTab,
  onSelectAccount,
  onSelectEntry,
}: Props) {
  const clientByGrabio = useMemo(
    () => buildClientByGrabioMap(pcgClientAccounts),
    [pcgClientAccounts],
  );

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive)
        .map((account) => {
          const label = isLebaneseCoa
            ? formatGlAccountReference(account.code, account.name, clientByGrabio)
            : `${account.code} · ${account.name}`;
          return {
            id: account.id,
            label,
            keywords: `${account.code} ${account.name} ${account.nameAr || ""}`,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [accounts, isLebaneseCoa, clientByGrabio],
  );

  const recentVouchers = useMemo(
    () =>
      [...entries]
        .filter((entry) => entry.status === "posted")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        .slice(0, 20),
    [entries],
  );

  const run = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search sections, accounts, vouchers…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Go to section">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <CommandItem
                key={tab.value}
                value={`section ${tab.label} ${tab.value}`}
                onSelect={() => run(() => onSelectTab(tab.value))}
              >
                <Icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                {tab.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {accountOptions.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Accounts — open ledger">
              {accountOptions.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`account ${account.label} ${account.keywords}`}
                  onSelect={() => run(() => onSelectAccount(account.id, account.label))}
                >
                  {account.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {recentVouchers.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent vouchers">
              {recentVouchers.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`voucher ${entry.voucherNumber || entry.id} ${entry.memo || ""} ${entry.voucherType || ""}`}
                  onSelect={() => run(() => onSelectEntry(entry.id))}
                >
                  <span className="font-mono text-xs mr-2 shrink-0">
                    {entry.voucherNumber || entry.voucherType || "JE"}
                  </span>
                  <span className="truncate">{entry.memo || entry.date.slice(0, 10)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
