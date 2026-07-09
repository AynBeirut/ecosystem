import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  isGrabioOpsUser,
  listAllWordPressRequests,
  listWordPressRequestsForStore,
  updateWordPressRequestStatus,
} from '@/lib/wordpressProvisioningService';
import type {
  WordPressProvisioningRequest,
  WordPressProvisioningStatus,
} from '@/types/wordpressProvisioning';

const STATUS_LABELS: Record<WordPressProvisioningStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const AdminWordPressQueue: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [isOps, setIsOps] = useState(false);
  const [requests, setRequests] = useState<WordPressProvisioningRequest[]>([]);
  const [opsNotes, setOpsNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const ops = await isGrabioOpsUser(user.uid);
      setIsOps(ops);
      if (ops) {
        setRequests(await listAllWordPressRequests());
      } else if (storeId) {
        setRequests(await listWordPressRequestsForStore(storeId));
      } else {
        setRequests([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (requestId: string, status: WordPressProvisioningStatus) => {
    if (!isOps) return;
    setSavingId(requestId);
    try {
      await updateWordPressRequestStatus(requestId, status, opsNotes[requestId]);
      toast.success('Request updated');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminPageShell
      title={isOps ? 'WordPress provisioning queue' : 'Your WordPress requests'}
      description={
        isOps
          ? 'Manual provisioning queue — update status as you set up hosting and hand off credentials.'
          : 'Track WordPress setup requests submitted from the Store Builder.'
      }
      eyebrow="WordPress"
      backTo="/admin/dashboard"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <AdminPanel>
          <CardContent className="py-8 text-center text-muted-foreground">
            No WordPress requests yet.
            {!isOps && (
              <p className="mt-2 text-sm">
                Start from{' '}
                <a href="/admin/builder" className="text-primary underline">
                  Store Builder
                </a>{' '}
                → Build with WordPress.
              </p>
            )}
          </CardContent>
        </AdminPanel>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <AdminPanel key={req.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{req.businessName}</p>
                    <p className="text-sm text-muted-foreground">{req.contactEmail}</p>
                    {req.preferredDomain && (
                      <p className="text-sm text-muted-foreground">Domain: {req.preferredDomain}</p>
                    )}
                    {isOps && (
                      <p className="text-xs text-muted-foreground mt-1">Store: {req.storeId}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {req.notes && <p className="text-sm">{req.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  Submitted {new Date(req.createdAt).toLocaleString()}
                </p>
                {isOps && (
                  <div className="flex flex-wrap gap-3 items-end pt-2 border-t">
                    <div className="flex-1 min-w-[200px]">
                      <Textarea
                        rows={2}
                        placeholder="Ops notes (optional)"
                        value={opsNotes[req.id] ?? req.opsNotes ?? ''}
                        onChange={(e) =>
                          setOpsNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Select
                      value={req.status}
                      onValueChange={(v) =>
                        void handleStatusChange(req.id, v as WordPressProvisioningStatus)
                      }
                      disabled={savingId === req.id}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!isOps && req.opsNotes && (
                  <p className="text-sm text-muted-foreground border-t pt-2">{req.opsNotes}</p>
                )}
              </CardContent>
            </AdminPanel>
          ))}
        </div>
      )}
      {isOps && (
        <p className="text-xs text-muted-foreground mt-4">
          Ops access is controlled by <code className="text-xs">platformConfig/grabio.opsUids</code> in
          Firestore.
        </p>
      )}
    </AdminPageShell>
  );
};

export default AdminWordPressQueue;
