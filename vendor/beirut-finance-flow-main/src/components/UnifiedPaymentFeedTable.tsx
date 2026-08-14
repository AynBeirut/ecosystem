import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { UnifiedPaymentRow } from '@/lib/grabio/unifiedPaymentFeed';

type Props = {
  rows: UnifiedPaymentRow[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onReload: () => void;
};

export default function UnifiedPaymentFeedTable({
  rows,
  loading,
  error,
  emptyMessage,
  onReload,
}: Props) {
  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading payments from all portals…</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 border rounded-md text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60">
            <th className="py-3 px-4 text-left font-medium">Date</th>
            <th className="py-3 px-4 text-left font-medium">Party</th>
            <th className="py-3 px-4 text-left font-medium">Source</th>
            <th className="py-3 px-4 text-left font-medium">Reference</th>
            <th className="py-3 px-4 text-right font-medium">Amount</th>
            <th className="py-3 px-4 text-left font-medium">Method</th>
            <th className="py-3 px-4 text-right font-medium">Links</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-3 px-4 whitespace-nowrap">{row.date || '—'}</td>
              <td className="py-3 px-4">{row.partyName}</td>
              <td className="py-3 px-4">{row.sourceLabel}</td>
              <td className="py-3 px-4 font-mono text-xs">{row.reference}</td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                {row.currency} {row.amount.toFixed(2)}
              </td>
              <td className="py-3 px-4 capitalize">{row.method || '—'}</td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  {row.adminLink ? (
                    <Link to={row.adminLink} className="text-teal-700 hover:underline text-xs font-medium">
                      Source
                    </Link>
                  ) : null}
                  <Link to={row.accountingLink} className="text-teal-700 hover:underline text-xs font-medium">
                    GL
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
