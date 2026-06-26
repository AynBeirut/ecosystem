import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Users, Send, Clock, CheckCircle, AlertCircle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

interface Subscriber {
  email: string;
  name: string;
  subscribedAt?: any;
}

interface Campaign {
  id: string;
  subject: string;
  previewText?: string;
  sentTo: number;
  errors: number;
  sentAt?: any;
}

const AdminMarketing: React.FC = () => {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);

  // Subscribers state
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Compose form
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [sending, setSending] = useState(false);

  // Manual add subscriber
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addingSubscriber, setAddingSubscriber] = useState(false);

  useEffect(() => {
    if (user) {
      const sid = getActualStoreId(user);
      setStoreId(sid);
    }
  }, [user]);

  const getToken = useCallback(async (): Promise<string> => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    return currentUser.getIdToken();
  }, []);

  const fetchSubscribers = useCallback(async () => {
    if (!storeId) return;
    setLoadingSubscribers(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/marketing/subscribers?storeId=${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSubscribers(data.subscribers || []);
      else toast.error(data.error || 'Failed to load subscribers');
    } catch {
      toast.error('Failed to load subscribers');
    } finally {
      setLoadingSubscribers(false);
    }
  }, [storeId, getToken]);

  const fetchCampaigns = useCallback(async () => {
    if (!storeId) return;
    setLoadingCampaigns(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/marketing/campaigns?storeId=${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setCampaigns(data.campaigns || []);
      else toast.error(data.error || 'Failed to load campaigns');
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [storeId, getToken]);

  useEffect(() => {
    if (storeId) {
      fetchSubscribers();
      fetchCampaigns();
    }
  }, [storeId, fetchSubscribers, fetchCampaigns]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !addEmail) return;
    setAddingSubscriber(true);
    try {
      const res = await fetch(`${API_URL}/marketing/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail, name: addName, storeId }),
      });
      const data = await res.json();
      if (data.success) {
        toast('Subscriber added');
        setAddEmail('');
        setAddName('');
        fetchSubscribers();
      } else {
        toast.error(data.error || 'Failed to add subscriber');
      }
    } catch {
      toast.error('Failed to add subscriber');
    } finally {
      setAddingSubscriber(false);
    }
  };

  const handleRemoveSubscriber = async (email: string) => {
    if (!storeId) return;
    try {
      const res = await fetch(`${API_URL}/marketing/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, storeId }),
      });
      const data = await res.json();
      if (data.success) {
        toast('Subscriber removed');
        setSubscribers(prev => prev.filter(s => s.email !== email));
      } else {
        toast.error(data.error || 'Failed to remove subscriber');
      }
    } catch {
      toast.error('Failed to remove subscriber');
    }
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !subject || !htmlBody) {
      toast.error('Subject and body are required');
      return;
    }
    if (subscribers.length === 0) {
      toast.error('No subscribers to send to');
      return;
    }
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/marketing/send-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId, subject, htmlBody, previewText }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`Campaign sent to ${data.sent} subscriber${data.sent !== 1 ? 's' : ''}${data.errors ? ` (${data.errors} failed)` : ''}`);
        setSubject('');
        setPreviewText('');
        setHtmlBody('');
        fetchCampaigns();
      } else {
        toast.error(data.error || 'Failed to send campaign');
      }
    } catch {
      toast.error('Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (ts: any): string => {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AdminPageShell
      title="Email Marketing"
      description="Manage subscribers and send campaigns"
      eyebrow="Business Tools"
    >
      <div className="max-w-5xl">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-4 flex items-center gap-3">
              <Users className="text-blue-500" size={28} />
              <div>
                <p className="text-2xl font-bold">{subscribers.length}</p>
                <p className="text-xs text-gray-500">Active Subscribers</p>
              </div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-4 flex items-center gap-3">
              <Send className="text-green-500" size={28} />
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-gray-500">Campaigns Sent</p>
              </div>
            </CardContent>
          </AdminPanel>
          <AdminPanel className="col-span-2 md:col-span-1">
            <CardContent className="pt-4 flex items-center gap-3">
              <Mail className="text-purple-500" size={28} />
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + (c.sentTo || 0), 0)}
                </p>
                <p className="text-xs text-gray-500">Total Emails Delivered</p>
              </div>
            </CardContent>
          </AdminPanel>
        </div>

        <Tabs defaultValue="compose">
          <TabsList className="mb-4">
            <TabsTrigger value="compose"><Send size={14} className="mr-1" />Compose</TabsTrigger>
            <TabsTrigger value="subscribers"><Users size={14} className="mr-1" />Subscribers</TabsTrigger>
            <TabsTrigger value="history"><Clock size={14} className="mr-1" />History</TabsTrigger>
          </TabsList>

          {/* ── Compose ── */}
          <TabsContent value="compose">
            <AdminPanel>
              <CardHeader>
                <CardTitle>New Campaign</CardTitle>
                <CardDescription>
                  Send an email to all {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendCampaign} className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="e.g. New arrivals this week 🎉"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="previewText">Preview text (shown in inbox)</Label>
                    <Input
                      id="previewText"
                      placeholder="A short teaser that appears under the subject..."
                      value={previewText}
                      onChange={e => setPreviewText(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="htmlBody">Email body (HTML or plain text) *</Label>
                    <Textarea
                      id="htmlBody"
                      placeholder={`<h2>Hi there!</h2>\n<p>We have exciting news...</p>`}
                      value={htmlBody}
                      onChange={e => setHtmlBody(e.target.value)}
                      rows={10}
                      required
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      HTML accepted. An unsubscribe footer is added automatically.
                    </p>
                  </div>
                  {htmlBody && (
                    <div className="rounded border p-4 bg-white max-h-64 overflow-y-auto">
                      <p className="text-xs text-gray-400 mb-2">Preview:</p>
                      <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={sending || subscribers.length === 0}
                    className="w-full"
                  >
                    {sending ? (
                      <><RefreshCw size={16} className="mr-2 animate-spin" />Sending…</>
                    ) : (
                      <><Send size={16} className="mr-2" />Send to {subscribers.length} Subscribers</>
                    )}
                  </Button>
                  {subscribers.length === 0 && (
                    <p className="text-xs text-amber-500 text-center">
                      You need at least one subscriber. Add them in the Subscribers tab.
                    </p>
                  )}
                </form>
              </CardContent>
            </AdminPanel>
          </TabsContent>

          {/* ── Subscribers ── */}
          <TabsContent value="subscribers">
            <div className="space-y-4">
              {/* Add manually */}
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="text-base">Add Subscriber</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddSubscriber} className="flex flex-col md:flex-row gap-2">
                    <Input
                      placeholder="Name (optional)"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      className="md:w-40"
                    />
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={addEmail}
                      onChange={e => setAddEmail(e.target.value)}
                      required
                      className="flex-1"
                    />
                    <Button type="submit" disabled={addingSubscriber} className="shrink-0">
                      <Plus size={16} className="mr-1" />
                      {addingSubscriber ? 'Adding…' : 'Add'}
                    </Button>
                  </form>
                </CardContent>
              </AdminPanel>

              {/* List */}
              <AdminPanel>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">
                      Active Subscribers ({subscribers.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchSubscribers} disabled={loadingSubscribers}>
                      <RefreshCw size={14} className={loadingSubscribers ? 'animate-spin' : ''} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {subscribers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No subscribers yet. Add them manually or let customers subscribe from your store page.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subscribers.map(s => (
                        <div key={s.email} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{s.name || s.email}</p>
                            {s.name && <p className="text-xs text-gray-400">{s.email}</p>}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSubscriber(s.email)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </AdminPanel>
            </div>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history">
            <AdminPanel>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Campaign History</CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchCampaigns} disabled={loadingCampaigns}>
                    <RefreshCw size={14} className={loadingCampaigns ? 'animate-spin' : ''} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No campaigns sent yet.</p>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map(c => (
                      <div key={c.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{c.subject}</p>
                            {c.previewText && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.previewText}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{formatDate(c.sentAt)}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <CheckCircle size={11} />
                              {c.sentTo} sent
                            </Badge>
                            {c.errors > 0 && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <AlertCircle size={11} />
                                {c.errors} failed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
  );
};

export default AdminMarketing;
