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
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 className="font-medium">{row.partyName || "Receipt"}</h3>
            <p className="text-sm text-muted-foreground">
              {row.date || "—"} · {row.currency} {row.amount.toFixed(2)} · {row.sourceLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.adminLink ? (
              <Link to={row.adminLink}>
                <Button type="button" variant="outline" size="sm">Source</Button>
              </Link>
            ) : null}
            <Link to={row.accountingLink}>
              <Button type="button" variant="outline" size="sm">GL</Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
