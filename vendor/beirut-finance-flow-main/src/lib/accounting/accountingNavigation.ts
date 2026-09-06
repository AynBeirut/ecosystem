import type { GlVoucherSummary } from '@/components/GlVoucherSummaryStrip';

/** Open voucher detail slide sheet (same handler as GL report rows). */
export type OpenVoucherEntryHandler = (entryId: string, glSummary?: GlVoucherSummary | null) => void;

/** Open account activity slide sheet (GL-style movement list for one account). */
export type OpenAccountActivityHandler = (accountId: string, label?: string, periodEnd?: string) => void;
