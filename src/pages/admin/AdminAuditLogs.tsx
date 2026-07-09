import React, { useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

type AuditLogEntry = {
  id: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userName?: string;
  userRole?: string;
  timestamp?: unknown;
  createdAt?: unknown;
  storeId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  [key: string]: unknown;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }
    if (typeof maybeTimestamp.seconds === 'number') {
      return maybeTimestamp.seconds * 1000;
    }
  }
  return 0;
};

const formatDateTime = (value: unknown): string => {
  const millis = toMillis(value);
  if (!millis) return '—';
  return new Date(millis).toLocaleString();
};

const tryStringify = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const AdminAuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      const storeId = getActualStoreId(user);
      if (!storeId) return;

      setLoading(true);
      try {
        const db = getFirestore();
        const logsRef = collection(db, 'auditLogs');
        const logsQuery = query(logsRef, where('storeId', '==', storeId));
        const snapshot = await getDocs(logsQuery);

        const entries: AuditLogEntry[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }));

        entries.sort((a, b) => {
          const aMillis = toMillis(a.createdAt) || toMillis(a.timestamp);
          const bMillis = toMillis(b.createdAt) || toMillis(b.timestamp);
          return bMillis - aMillis;
        });

        setLogs(entries);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => String(log.action || '').trim()).filter(Boolean))).sort();
  }, [logs]);

  const entityOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => String(log.entityType || '').trim()).filter(Boolean))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter !== 'all' && String(log.action || '') !== actionFilter) return false;
      if (entityFilter !== 'all' && String(log.entityType || '') !== entityFilter) return false;

      const eventMillis = toMillis(log.createdAt) || toMillis(log.timestamp);
      if (dateFrom) {
        const fromMillis = new Date(`${dateFrom}T00:00:00`).getTime();
        if (eventMillis && eventMillis < fromMillis) return false;
      }
      if (dateTo) {
        const toMillisValue = new Date(`${dateTo}T23:59:59`).getTime();
        if (eventMillis && eventMillis > toMillisValue) return false;
      }

      if (!needle) return true;

      const searchableText = [
        log.action,
        log.entityType,
        log.entityId,
        log.userName,
        log.userRole,
        log.id,
        tryStringify(log.oldValue),
        tryStringify(log.newValue),
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return searchableText.includes(needle);
    });
  }, [logs, search, actionFilter, entityFilter, dateFrom, dateTo]);

  return (
    <AdminPageShell
      title="System Logs"
      description="Track movement and changes across your store (read-only)"
      backTo="/admin/dashboard"
      backLabel="Dashboard"
    >
        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search by action, entity, user, date, or value changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actionOptions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entityOptions.map((entity) => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </AdminPanel>

        <div className="mb-4 text-sm text-gray-600">
          {loading ? 'Loading logs...' : `${filteredLogs.length} log entries`}
        </div>

        <div className="space-y-3">
          {!loading && filteredLogs.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-8 text-center text-gray-500">
                No logs found for the selected filters.
              </CardContent>
            </AdminPanel>
          ) : null}

          {filteredLogs.map((log) => {
            const action = String(log.action || 'unknown');
            const entityType = String(log.entityType || 'system');
            const entityId = String(log.entityId || '—');
            const userName = String(log.userName || 'System');
            const eventTime = log.createdAt || log.timestamp;

            return (
              <AdminPanel key={log.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="secondary">{action}</Badge>
                    <Badge variant="outline">{entityType}</Badge>
                    <span className="text-xs text-gray-500">{formatDateTime(eventTime)}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">User:</span> {userName}</div>
                    <div><span className="text-gray-500">Entity ID:</span> {entityId}</div>
                  </div>
                  {(log.oldValue !== undefined || log.newValue !== undefined) ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-market-primary">View changes</summary>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                        <div className="bg-gray-50 border rounded p-2">
                          <div className="text-xs text-gray-500 mb-1">Old Value</div>
                          <pre className="text-xs whitespace-pre-wrap break-words">{tryStringify(log.oldValue) || '—'}</pre>
                        </div>
                        <div className="bg-gray-50 border rounded p-2">
                          <div className="text-xs text-gray-500 mb-1">New Value</div>
                          <pre className="text-xs whitespace-pre-wrap break-words">{tryStringify(log.newValue) || '—'}</pre>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </AdminPanel>
            );
          })}
        </div>

    </AdminPageShell>
  );
};

export default AdminAuditLogs;
