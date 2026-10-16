import React, { useCallback, useEffect, useState } from 'react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AdminPanel from '@/components/admin/AdminPanel';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import { useAuth } from '@/context/useAuth';
import { listTableReservations, updateTableReservation, type TableReservationRow } from '@/lib/tableReservationService';
import { loadVenueOps } from '@/lib/venueOpsCoreService';
import { tableReservationLabel } from '@/lib/tableReservation';

const TableReservationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<TableReservationRow[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const storeId = getActualStoreId(user) || await resolveStoreIdForAuthUser(user.id);
    if (!storeId) return;
    const [bookings, venue] = await Promise.all([
      listTableReservations(storeId),
      loadVenueOps(storeId),
    ]);
    setRows(bookings);
    setTables(venue.floor.filter((row) => row.active && row.tableLabel).map((row) => row.tableLabel));
  }, [user]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load table reservations.'));
  }, [load]);

  const save = async (row: TableReservationRow, status: TableReservationRow['status'], tableLabel?: string) => {
    setError('');
    try {
      await updateTableReservation(row.id, { status, tableLabel });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the reservation.');
    }
  };

  return (
    <AdminPanel>
      <CardHeader>
        <CardTitle className="text-lg">Online table reservations</CardTitle>
        <CardDescription>Requests from the store page. Confirm a table by its name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No table reservations yet.</p> : null}
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">{tableReservationLabel(row)}</p>
            <p className="text-xs text-muted-foreground">{row.guestPhone}{row.notes ? ` · ${row.notes}` : ''} · {row.status}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label={`Table for ${row.guestName}`}
                list={`table-choices-${index}`}
                defaultValue={row.tableLabel}
                placeholder="Table name"
                onBlur={(event) => void save(row, row.status, event.target.value)}
              />
              <datalist id={`table-choices-${index}`}>
                {tables.map((name) => <option key={name} value={name} />)}
              </datalist>
              <Button type="button" size="sm" variant="outline" onClick={() => void save(row, 'confirmed', row.tableLabel)}>Confirm</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void save(row, 'seated', row.tableLabel)}>Seat</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void save(row, 'cancelled', row.tableLabel)}>Cancel</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </AdminPanel>
  );
};

export default TableReservationsPanel;
