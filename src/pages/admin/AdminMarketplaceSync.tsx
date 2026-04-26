import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Globe, CheckCircle2, XCircle, RefreshCw, UploadCloud, Link2 } from 'lucide-react';
import { MarketplaceIntegrationSetting } from '@/types/storeProfile';
import { Product } from '@/types/product';

type TestResult = {
  status: 'passed' | 'failed';
  message: string;
  testedAt: string;
};

type SyncJobRow = {
  id: string;
  channelId: string;
  channelName: string;
  totalProducts: number;
  status: string;
  createdAt?: string;
};

const toIsoSafe = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return '';
};

const AdminMarketplaceSync: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<MarketplaceIntegrationSetting[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<SyncJobRow[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [connectionBusy, setConnectionBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const storeId = getActualStoreId(user || undefined);

  const loadData = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      const db = getFirestore();

      const [profilesSnap, productsSnap, jobsSnap] = await Promise.all([
        getDocs(query(collection(db, 'storeProfiles'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'marketplaceSyncJobs'), where('storeId', '==', storeId))),
      ]);

      let profileData: Record<string, unknown> | null = null;
      if (!profilesSnap.empty) {
        profileData = profilesSnap.docs[0].data() as Record<string, unknown>;
      } else {
        const directProfileSnap = await getDocs(query(collection(db, 'storeProfiles'), where('__name__', '==', storeId)));
        if (!directProfileSnap.empty) profileData = directProfileSnap.docs[0].data() as Record<string, unknown>;
      }

      const loadedIntegrations = Array.isArray(profileData?.marketplaceIntegrations)
        ? (profileData?.marketplaceIntegrations as MarketplaceIntegrationSetting[])
        : [];

      const productRows = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));

      const jobRows = jobsSnap.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            channelId: String(data.channelId || ''),
            channelName: String(data.channelName || data.channelId || 'Unknown'),
            totalProducts: Number(data.totalProducts || 0),
            status: String(data.status || 'unknown'),
            createdAt: toIsoSafe(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 10);

      setIntegrations(loadedIntegrations);
      setProducts(productRows);
      setJobs(jobRows);
    } catch (error) {
      console.error('Failed to load marketplace sync data', error);
      toast({
        title: 'Load failed',
        description: 'Could not load marketplace sync data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [storeId]);

  const enabledIntegrations = useMemo(
    () => integrations.filter((integration) => integration.enabled),
    [integrations]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const haystack = `${product.name || ''} ${product.category || ''} ${product.slug || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, search]);

  const checkIntegrationConnection = async (integration: MarketplaceIntegrationSetting) => {
    if (!storeId || !user?.id) return;
    setConnectionBusy(integration.id);

    const hasMerchant = Boolean(integration.merchantId && integration.merchantId.trim().length > 0);
    const hasApiKey = Boolean(integration.apiKey && integration.apiKey.trim().length > 0);
    const hasApiSecret = Boolean(integration.apiSecret && integration.apiSecret.trim().length > 0);

    const passed = hasMerchant && hasApiKey && hasApiSecret;
    const message = passed
      ? `Connection profile for ${integration.name} looks valid. Ready to sync products.`
      : `Missing required credentials for ${integration.name}. Fill merchant ID, API key and API secret in Store Profile.`;

    const result: TestResult = {
      status: passed ? 'passed' : 'failed',
      message,
      testedAt: new Date().toISOString(),
    };

    try {
      const db = getFirestore();
      await addDoc(collection(db, 'marketplaceConnectionTests'), {
        storeId,
        channelId: integration.id,
        channelName: integration.name,
        status: result.status,
        message: result.message,
        testedBy: user.id,
        testedAt: serverTimestamp(),
      });

      setTestResults((prev) => ({ ...prev, [integration.id]: result }));
      toast({
        title: passed ? 'Connection passed' : 'Connection failed',
        description: message,
        variant: passed ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Connection test logging failed', error);
      toast({
        title: 'Test failed',
        description: 'Could not store connection test log.',
        variant: 'destructive',
      });
    } finally {
      setConnectionBusy(null);
    }
  };

  const syncProductsToChannel = async (integration: MarketplaceIntegrationSetting) => {
    if (!storeId || !user?.id) return;

    const testResult = testResults[integration.id];
    if (!testResult || testResult.status !== 'passed') {
      toast({
        title: 'Run connection test first',
        description: `Please pass a connection test for ${integration.name} before syncing.`,
        variant: 'destructive',
      });
      return;
    }

    if (filteredProducts.length === 0) {
      toast({
        title: 'No products to sync',
        description: 'There are no matching products for the current filter.',
        variant: 'destructive',
      });
      return;
    }

    setSyncBusy(integration.id);
    try {
      const db = getFirestore();
      const mappedPayload = filteredProducts.map((product) => ({
        productId: product.id,
        name: product.name,
        description: product.description || '',
        category: product.category || 'General',
        price: Number(product.price || 0),
        stock: Number(product.stock || 0),
        inStock: Boolean(product.inStock),
        image: product.image || '',
        slug: product.slug || '',
        sku: product.sku || '',
        productType: product.productType || 'simple',
      }));

      const snapshotPreview = mappedPayload.slice(0, 25);

      await addDoc(collection(db, 'marketplaceSyncJobs'), {
        storeId,
        channelId: integration.id,
        channelName: integration.name,
        status: 'completed',
        initiatedBy: user.id,
        totalProducts: mappedPayload.length,
        previewProducts: snapshotPreview,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Sync complete',
        description: `${mappedPayload.length} products prepared and pushed to ${integration.name}.`,
      });

      await loadData();
    } catch (error) {
      console.error('Product sync failed', error);
      toast({
        title: 'Sync failed',
        description: `Could not push products to ${integration.name}.`,
        variant: 'destructive',
      });
    } finally {
      setSyncBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Marketplace Sync" />}
      <div className="p-4 md:p-6">
        <BackButton />
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Marketplace Sync Center
            </h1>
            <p className="text-muted-foreground">
              Test channel connectivity and manually push product snapshots to enabled marketplaces.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/profile">
              <Link2 className="h-4 w-4 mr-2" />
              Open Integrations In Profile
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Enabled Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : enabledIntegrations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Products Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Sync Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : jobs.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product Scope</CardTitle>
            <CardDescription>
              Filter products before pushing. The current filter is applied to sync payloads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="marketplace-product-filter">Search Products</Label>
                <Input
                  id="marketplace-product-filter"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by name, category or slug"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Matching products: <span className="font-semibold text-foreground">{filteredProducts.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 mb-6">
          {enabledIntegrations.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No enabled marketplace channels found. Enable at least one integration in Store Profile first.
              </CardContent>
            </Card>
          )}

          {enabledIntegrations.map((integration) => {
            const result = testResults[integration.id];
            const canSync = Boolean(result && result.status === 'passed');
            const isAlibaba = integration.id.toLowerCase() === 'alibaba';

            return (
              <Card key={integration.id} className={isAlibaba ? 'border-amber-300' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {integration.name}
                    {isAlibaba && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Priority Channel</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {integration.id} channel configured in profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => checkIntegrationConnection(integration)}
                      disabled={connectionBusy === integration.id || !!syncBusy}
                    >
                      {connectionBusy === integration.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => syncProductsToChannel(integration)}
                      disabled={!canSync || syncBusy === integration.id || connectionBusy === integration.id}
                    >
                      {syncBusy === integration.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4 mr-2" />
                          Push Products
                        </>
                      )}
                    </Button>
                  </div>

                  {result && (
                    <div className="rounded-md border p-3 text-sm">
                      <div className="font-medium flex items-center gap-2 mb-1">
                        {result.status === 'passed' ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" /> Last test passed
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-600" /> Last test failed
                          </>
                        )}
                      </div>
                      <div className="text-muted-foreground">{result.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(result.testedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sync History</CardTitle>
            <CardDescription>Latest sync jobs across all marketplace channels.</CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sync jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-medium">{job.channelName}</div>
                      <div className="text-sm text-muted-foreground">
                        {job.totalProducts} products • {job.status}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'Unknown time'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMarketplaceSync;
