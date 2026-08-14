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
import { auditLogSearchText, presentAuditLog } from '@/lib/auditLogPresentation';

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

const actionBadgeClass = (action: string): string => {
  switch (action) {
    case 'create':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'update':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'delete':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'approve':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'reject':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return '';
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
        auditLogSearchText(log),
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return searchableText.includes(needle);
    });
  }, [logs, search, actionFilter, entityFilter, dateFrom, dateTo]);

  return (
    <AdminPageShell
      title="Store Logs"
      description="See who changed what in your store — plain language, no raw data dumps"
      backTo="/admin/dashboard"
      backLabel="Dashboard"
    >
        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search by user, action, entity, or date</CardDescription>
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
            const userName = String(log.userName || 'System');
            const userRole = String(log.userRole || '').trim();
            const eventTime = log.createdAt || log.timestamp;
            const summary = presentAuditLog(log);

            return (
              <AdminPanel key={log.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline" className={actionBadgeClass(action)}>
                      {action}
                    </Badge>
                    <Badge variant="outline">{entityType.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-gray-500">{formatDateTime(eventTime)}</span>
                  </div>

                  <p className="text-sm font-medium text-gray-900">{summary.headline}</p>

                  {summary.details.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                      {summary.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span><span className="font-medium text-gray-600">Account:</span> {userName}</span>
                    {userRole ? <span><span className="font-medium text-gray-600">Role:</span> {userRole}</span> : null}
                  </div>
                </CardContent>
              </AdminPanel>
            );
          })}
        </div>

    </AdminPageShell>
  );
};

export default AdminAuditLogs;
