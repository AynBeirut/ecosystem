import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  doc,
  collection,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Globe, CheckCircle2, XCircle, RefreshCw, UploadCloud, Link2, ExternalLink } from 'lucide-react';
import { MarketplaceIntegrationSetting } from '@/types/storeProfile';
import { Product } from '@/types/product';
import {
  buildMarketplacePayload,
  filterIncrementalProducts,
  type MarketplacePayload,
} from '@/lib/marketplaceSync';

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
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  failedCount: number;
  failedReason?: string;
  createdAt?: string;
};

type ChannelSyncSettings = {
  id: string;
  storeId: string;
  channelId: string;
  syncMode: 'full' | 'incremental';
  autoRetryFailed: boolean;
  requiredFields?: string[];
  lastSuccessfulSyncAt?: string;
  updatedBy?: string;
};

type ValidationReport = {
  channelId: string;
  total: number;
  validCount: number;
  invalidCount: number;
  errorSamples: string[];
  validatedAt: string;
};

const DEFAULT_REQUIRED_FIELDS: Record<string, string[]> = {
  alibaba: ['name', 'description', 'category', 'price', 'image', 'stock'],
  amazon: ['name', 'description', 'category', 'price', 'image', 'sku'],
  walmart: ['name', 'description', 'category', 'price', 'image', 'stock'],
  ebay: ['name', 'description', 'category', 'price', 'image'],
  etsy: ['name', 'description', 'category', 'price', 'image'],
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Product Name',
  description: 'Description',
  category: 'Category',
  price: 'Price',
  image: 'Main Image',
  stock: 'Stock Quantity',
  sku: 'SKU',
};

const AVAILABLE_MAPPING_FIELDS = ['name', 'description', 'category', 'price', 'image', 'stock', 'sku'];
const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

type MetaCatalogState = {
  pixelId?: string;
  catalogId?: string;
  facebookPageUrl?: string;
  catalogFeedUrl?: string;
  lastCatalogSyncAt?: string;
  lastCatalogProductCount?: number;
  facebookShopEnabled?: boolean;
  facebookShopStatus?: string;
  facebookShopConnectedAt?: string;
  instagramShoppingEnabled?: boolean;
  instagramShoppingStatus?: string;
  instagramShoppingConnectedAt?: string;
  adAccountId?: string;
  metaAdsEnabled?: boolean;
  lastMetaAdsCampaignId?: string;
  lastMetaAdsCampaignName?: string;
  lastMetaAdsCampaignAt?: string;
  lastMetaAdsCampaignStatus?: string;
  dynamicProductAdsEnabled?: boolean;
  dynamicProductAdsStatus?: string;
  dynamicProductAdsAudienceName?: string;
  dynamicProductAdsRetargetingWindowDays?: number;
  dynamicProductAdsMinimumEventCount?: number;
  lastDynamicProductAdsAt?: string;
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

  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<MarketplaceIntegrationSetting[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<SyncJobRow[]>([]);
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSyncSettings>>({});
  const [channelLastCompletedAt, setChannelLastCompletedAt] = useState<Record<string, string>>({});
  const [validationReports, setValidationReports] = useState<Record<string, ValidationReport>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [connectionBusy, setConnectionBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [validationBusy, setValidationBusy] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [metaSyncBusy, setMetaSyncBusy] = useState(false);
  const [shopConnectBusy, setShopConnectBusy] = useState(false);
  const [instagramConnectBusy, setInstagramConnectBusy] = useState(false);
  const [metaAdsBusy, setMetaAdsBusy] = useState(false);
  const [dynamicAdsBusy, setDynamicAdsBusy] = useState(false);
  const [shopOnboardingUrl, setShopOnboardingUrl] = useState('');
  const [adsManagerUrl, setAdsManagerUrl] = useState('');
  const [adsCampaignName, setAdsCampaignName] = useState('Meta Product Campaign');
  const [adsObjective, setAdsObjective] = useState('SALES');
  const [adsDailyBudget, setAdsDailyBudget] = useState(20);
  const [dynamicAudienceName, setDynamicAudienceName] = useState('Recent Product Viewers');
  const [dynamicWindowDays, setDynamicWindowDays] = useState(14);
  const [dynamicMinEvents, setDynamicMinEvents] = useState(100);
  const [metaCatalog, setMetaCatalog] = useState<MetaCatalogState>({});
  const [search, setSearch] = useState('');

  const storeId = getActualStoreId(user || undefined);

  const loadData = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      const db = getFirestore();

      const [profilesSnap, productsSnap, jobsSnap, settingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'storeProfiles'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'marketplaceSyncJobs'), where('storeId', '==', storeId))),
        getDocs(query(collection(db, 'marketplaceChannelSettings'), where('storeId', '==', storeId))),
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
      const loadedMeta = ((profileData?.metaIntegrationSettings || {}) as MetaCatalogState) || {};

      const productRows = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));

      const completedByChannel = jobsSnap.docs.reduce((acc, row) => {
        const data = row.data() as Record<string, unknown>;
        const channelId = String(data.channelId || '');
        const status = String(data.status || '').toLowerCase();
        const createdAtIso = toIsoSafe(data.createdAt);
        if (!channelId || status !== 'completed' || !createdAtIso) return acc;
        if (!acc[channelId] || createdAtIso > acc[channelId]) {
          acc[channelId] = createdAtIso;
        }
        return acc;
      }, {} as Record<string, string>);

      const jobRows = jobsSnap.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const rawStatus = String(data.status || 'unknown').toLowerCase();
          let status: SyncJobRow['status'] = 'unknown';
          if (rawStatus === 'queued' || rawStatus === 'processing' || rawStatus === 'completed' || rawStatus === 'failed') {
            status = rawStatus;
          }
          return {
            id: doc.id,
            channelId: String(data.channelId || ''),
            channelName: String(data.channelName || data.channelId || 'Unknown'),
            totalProducts: Number(data.totalProducts || 0),
            status,
            failedCount: Number(data.failedCount || 0),
            failedReason: String(data.failedReason || ''),
            createdAt: toIsoSafe(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 10);

      const settingRows = settingsSnap.docs.reduce((acc, row) => {
        const data = row.data() as Record<string, unknown>;
        const channelId = String(data.channelId || '');
        if (!channelId) return acc;
        acc[channelId] = {
          id: row.id,
          storeId: String(data.storeId || storeId),
          channelId,
          syncMode: data.syncMode === 'incremental' ? 'incremental' : 'full',
          autoRetryFailed: Boolean(data.autoRetryFailed),
          requiredFields: Array.isArray(data.requiredFields)
            ? (data.requiredFields as unknown[]).map((value) => String(value))
            : undefined,
          lastSuccessfulSyncAt: toIsoSafe(data.lastSuccessfulSyncAt),
          updatedBy: String(data.updatedBy || ''),
        };
        return acc;
      }, {} as Record<string, ChannelSyncSettings>);

      setIntegrations(loadedIntegrations);
      setMetaCatalog({
        pixelId: String(loadedMeta.pixelId || '').trim(),
        catalogId: String(loadedMeta.catalogId || '').trim(),
        facebookPageUrl: String(loadedMeta.facebookPageUrl || '').trim(),
        catalogFeedUrl: String(loadedMeta.catalogFeedUrl || '').trim(),
        lastCatalogSyncAt: String(loadedMeta.lastCatalogSyncAt || '').trim(),
        lastCatalogProductCount: Number(loadedMeta.lastCatalogProductCount || 0),
        facebookShopEnabled: Boolean(loadedMeta.facebookShopEnabled),
        facebookShopStatus: String(loadedMeta.facebookShopStatus || '').trim(),
        facebookShopConnectedAt: String(loadedMeta.facebookShopConnectedAt || '').trim(),
        instagramShoppingEnabled: Boolean(loadedMeta.instagramShoppingEnabled),
        instagramShoppingStatus: String(loadedMeta.instagramShoppingStatus || '').trim(),
        instagramShoppingConnectedAt: String(loadedMeta.instagramShoppingConnectedAt || '').trim(),
        adAccountId: String(loadedMeta.adAccountId || '').trim(),
        metaAdsEnabled: Boolean(loadedMeta.metaAdsEnabled),
        lastMetaAdsCampaignId: String(loadedMeta.lastMetaAdsCampaignId || '').trim(),
        lastMetaAdsCampaignName: String(loadedMeta.lastMetaAdsCampaignName || '').trim(),
        lastMetaAdsCampaignAt: String(loadedMeta.lastMetaAdsCampaignAt || '').trim(),
        lastMetaAdsCampaignStatus: String(loadedMeta.lastMetaAdsCampaignStatus || '').trim(),
        dynamicProductAdsEnabled: Boolean(loadedMeta.dynamicProductAdsEnabled),
        dynamicProductAdsStatus: String(loadedMeta.dynamicProductAdsStatus || '').trim(),
        dynamicProductAdsAudienceName: String(loadedMeta.dynamicProductAdsAudienceName || '').trim(),
        dynamicProductAdsRetargetingWindowDays: Number(loadedMeta.dynamicProductAdsRetargetingWindowDays || 14),
        dynamicProductAdsMinimumEventCount: Number(loadedMeta.dynamicProductAdsMinimumEventCount || 100),
        lastDynamicProductAdsAt: String(loadedMeta.lastDynamicProductAdsAt || '').trim(),
      });
      if (String(loadedMeta.catalogId || '').trim()) {
        setShopOnboardingUrl(`https://business.facebook.com/commerce_manager/catalogs/${encodeURIComponent(String(loadedMeta.catalogId || '').trim())}`);
      } else {
        setShopOnboardingUrl('');
      }
      if (String(loadedMeta.adAccountId || '').trim()) {
        setAdsManagerUrl(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(String(loadedMeta.adAccountId || '').trim())}`);
      } else {
        setAdsManagerUrl('');
      }
      setDynamicAudienceName(String(loadedMeta.dynamicProductAdsAudienceName || 'Recent Product Viewers'));
      setDynamicWindowDays(Number(loadedMeta.dynamicProductAdsRetargetingWindowDays || 14));
      setDynamicMinEvents(Number(loadedMeta.dynamicProductAdsMinimumEventCount || 100));
      setProducts(productRows);
      setJobs(jobRows);
      setChannelSettings(settingRows);
      setChannelLastCompletedAt(completedByChannel);
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

  const getChannelSettings = (integration: MarketplaceIntegrationSetting): ChannelSyncSettings => {
    const existing = channelSettings[integration.id];
    if (existing) return existing;
    return {
      id: `${storeId}_${integration.id}`,
      storeId: storeId || '',
      channelId: integration.id,
      syncMode: 'full',
      autoRetryFailed: false,
      requiredFields: DEFAULT_REQUIRED_FIELDS[integration.id.toLowerCase()] || ['name', 'description', 'category', 'price'],
    };
  };

  const getRequiredFields = (integration: MarketplaceIntegrationSetting): string[] => {
    const settings = getChannelSettings(integration);
    if (settings.requiredFields && settings.requiredFields.length > 0) return settings.requiredFields;
    return DEFAULT_REQUIRED_FIELDS[integration.id.toLowerCase()] || ['name', 'description', 'category', 'price'];
  };

  const saveChannelSettings = async (channelId: string, patch: Partial<ChannelSyncSettings>) => {
    if (!storeId || !user?.id) return;
    setSavingSettings(channelId);
    try {
      const db = getFirestore();
      const current = channelSettings[channelId] || {
        id: `${storeId}_${channelId}`,
        storeId,
        channelId,
        syncMode: 'full' as const,
        autoRetryFailed: false,
      };

      const next: ChannelSyncSettings = {
        ...current,
        ...patch,
        updatedBy: user.id,
      };

      await setDoc(
        doc(db, 'marketplaceChannelSettings', `${storeId}_${channelId}`),
        {
          ...next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setChannelSettings((prev) => ({ ...prev, [channelId]: next }));
      toast({
        title: 'Settings saved',
        description: `Sync settings updated for ${channelId}.`,
      });
    } catch (error) {
      console.error('Failed to save sync settings', error);
      toast({
        title: 'Save failed',
        description: 'Could not save channel settings.',
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(null);
    }
  };

  const validateMappedPayload = (
    integration: MarketplaceIntegrationSetting,
    mappedPayload: MarketplacePayload[]
  ): ValidationReport => {
    const requiredFields = getRequiredFields(integration);
    const errors: string[] = [];
    let invalidCount = 0;

    mappedPayload.forEach((product) => {
      const missingForProduct: string[] = [];

      requiredFields.forEach((field) => {
        const value = product[field as keyof MarketplacePayload];

        if (field === 'price') {
          if (!Number.isFinite(Number(value)) || Number(value) <= 0) missingForProduct.push(field);
          return;
        }

        if (field === 'stock') {
          if (!Number.isFinite(Number(value)) || Number(value) < 0) missingForProduct.push(field);
          return;
        }

        if (typeof value === 'string') {
          if (!value.trim()) missingForProduct.push(field);
          return;
        }

        if (value === null || value === undefined) {
          missingForProduct.push(field);
        }
      });

      if (missingForProduct.length > 0) {
        invalidCount += 1;
        if (errors.length < 8) {
          const readable = missingForProduct.map((field) => FIELD_LABELS[field] || field).join(', ');
          errors.push(`${product.name || product.productId}: missing ${readable}`);
        }
      }
    });

    return {
      channelId: integration.id,
      total: mappedPayload.length,
      validCount: mappedPayload.length - invalidCount,
      invalidCount,
      errorSamples: errors,
      validatedAt: new Date().toISOString(),
    };
  };

  const runPreSyncValidation = async (integration: MarketplaceIntegrationSetting) => {
    setValidationBusy(integration.id);
    try {
      const payload = buildMappedPayload(filteredProducts);
      const transformedPayload = buildMarketplacePayload(integration.id, filteredProducts);
      const report = validateMappedPayload(integration, transformedPayload);

      setValidationReports((prev) => ({ ...prev, [integration.id]: report }));

      if (report.invalidCount > 0) {
        toast({
          title: 'Validation failed',
          description: `${integration.name}: ${report.invalidCount} product(s) are missing required mapped fields.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Validation passed',
          description: `${integration.name}: ${report.validCount} products are ready to sync.`,
        });
      }
    } finally {
      setValidationBusy(null);
    }
  };

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

  const syncProductsToChannel = async (integration: MarketplaceIntegrationSetting, retryOfJobId?: string) => {
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

    const preflight = validationReports[integration.id];
    if (!preflight || preflight.invalidCount > 0) {
      toast({
        title: 'Validation required',
        description: `Run and pass pre-sync validation for ${integration.name} before enqueueing jobs.`,
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
      const settings = getChannelSettings(integration);
      const fallbackLastSyncAt = channelLastCompletedAt[integration.id] || '';
      const sourceProducts = settings.syncMode === 'incremental'
        ? filterIncrementalProducts(filteredProducts, settings.lastSuccessfulSyncAt || fallbackLastSyncAt)
        : filteredProducts;

      if (sourceProducts.length === 0) {
        toast({
          title: 'No incremental changes',
          description: `${integration.name}: no products changed since last successful sync.`,
        });
        return;
      }

      const mappedPayload = buildMarketplacePayload(integration.id, sourceProducts);

      const invalidProducts = mappedPayload.filter((product) => !product.name || !Number.isFinite(product.price) || product.price <= 0);

      const snapshotPreview = mappedPayload.slice(0, 25);

      const jobRef = await addDoc(collection(db, 'marketplaceSyncJobs'), {
        storeId,
        channelId: integration.id,
        channelName: integration.name,
        status: 'queued',
        initiatedBy: user.id,
        retryOfJobId: retryOfJobId || null,
        syncMode: settings.syncMode,
        autoRetryFailed: settings.autoRetryFailed,
        requiredFields: settings.requiredFields || getRequiredFields(integration),
        totalProducts: mappedPayload.length,
        sourceScope: settings.syncMode,
        failedCount: 0,
        previewProducts: snapshotPreview,
        createdAt: serverTimestamp(),
        queuedAt: serverTimestamp(),
      });

      await updateDoc(jobRef, {
        status: 'processing',
        processingStartedAt: serverTimestamp(),
      });

      if (invalidProducts.length > 0) {
        const failedReason = `${invalidProducts.length} products have invalid names or non-positive prices.`;
        await updateDoc(jobRef, {
          status: 'failed',
          failedCount: invalidProducts.length,
          failedReason,
          failedProductsPreview: invalidProducts.slice(0, 25),
          finishedAt: serverTimestamp(),
        });

        toast({
          title: 'Sync failed',
          description: `${integration.name}: ${failedReason}`,
          variant: 'destructive',
        });

        await loadData();
        return;
      }

      await updateDoc(jobRef, {
        status: 'completed',
        successCount: mappedPayload.length,
        failedCount: 0,
        finishedAt: serverTimestamp(),
      });

      const completedAtIso = new Date().toISOString();
      await setDoc(
        doc(db, 'marketplaceChannelSettings', `${storeId}_${integration.id}`),
        {
          lastSuccessfulSyncAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: user.id,
        },
        { merge: true }
      );

      setChannelSettings((prev) => ({
        ...prev,
        [integration.id]: {
          ...getChannelSettings(integration),
          lastSuccessfulSyncAt: completedAtIso,
        },
      }));

      setChannelLastCompletedAt((prev) => ({
        ...prev,
        [integration.id]: completedAtIso,
      }));

      toast({
        title: 'Sync complete',
        description: `${mappedPayload.length} products pushed to ${integration.name} (${settings.syncMode} sync).`,
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

  const retryFailedJob = async (job: SyncJobRow) => {
    if (!job.channelId) return;
    const integration = enabledIntegrations.find((row) => row.id === job.channelId);
    if (!integration) {
      toast({
        title: 'Retry unavailable',
        description: 'Enable this channel in Store Profile before retrying.',
        variant: 'destructive',
      });
      return;
    }

    setRetryBusy(job.id);
    try {
      await syncProductsToChannel(integration, job.id);
    } finally {
      setRetryBusy(null);
    }
  };

  const runMetaCatalogSync = async () => {
    if (!storeId) return;
    setMetaSyncBusy(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/meta/catalog/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Meta catalog sync failed');
      }

      setMetaCatalog((prev) => ({
        ...prev,
        catalogFeedUrl: String(data?.feedUrl || prev.catalogFeedUrl || ''),
        lastCatalogSyncAt: String(data?.syncedAt || new Date().toISOString()),
        lastCatalogProductCount: Number(data?.summary?.validProducts || 0),
      }));

      toast({
        title: 'Meta catalog synced',
        description: `Synced ${Number(data?.summary?.validProducts || 0)} valid product(s).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Meta sync failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setMetaSyncBusy(false);
    }
  };

  const connectFacebookShop = async () => {
    if (!storeId) return;
    setShopConnectBusy(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/meta/shop/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Facebook Shop connection failed');
      }

      setMetaCatalog((prev) => ({
        ...prev,
        facebookShopEnabled: true,
        facebookShopStatus: String(data?.status || 'connected'),
        facebookShopConnectedAt: String(data?.connectedAt || new Date().toISOString()),
        catalogFeedUrl: String(data?.feedUrl || prev.catalogFeedUrl || ''),
      }));
      setShopOnboardingUrl(String(data?.onboardingUrl || shopOnboardingUrl || ''));

      toast({
        title: 'Facebook Shop connected',
        description: 'Integration is now linked. Open Commerce Manager to complete storefront setup.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Facebook Shop connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setShopConnectBusy(false);
    }
  };

  const connectInstagramShopping = async () => {
    if (!storeId) return;
    setInstagramConnectBusy(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/meta/instagram/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Instagram Shopping connection failed');
      }

      setMetaCatalog((prev) => ({
        ...prev,
        instagramShoppingEnabled: true,
        instagramShoppingStatus: String(data?.status || 'connected'),
        instagramShoppingConnectedAt: String(data?.connectedAt || new Date().toISOString()),
        catalogFeedUrl: String(data?.feedUrl || prev.catalogFeedUrl || ''),
      }));
      setShopOnboardingUrl(String(data?.onboardingUrl || shopOnboardingUrl || ''));

      toast({
        title: 'Instagram Shopping connected',
        description: 'Integration is now linked. Open Commerce Manager to complete Instagram setup.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Instagram Shopping connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setInstagramConnectBusy(false);
    }
  };

  const createMetaAdsCampaign = async () => {
    if (!storeId) return;
    setMetaAdsBusy(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const promotedProductIds = filteredProducts.slice(0, 50).map((product) => product.id);
      const response = await fetch(`${API_URL}/meta/ads/campaign/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId,
          name: adsCampaignName,
          objective: adsObjective,
          dailyBudget: adsDailyBudget,
          currency: 'USD',
          promotedProductIds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create Meta Ads campaign');
      }

      setMetaCatalog((prev) => ({
        ...prev,
        metaAdsEnabled: true,
        lastMetaAdsCampaignId: String(data?.campaignId || ''),
        lastMetaAdsCampaignName: String(data?.summary?.name || adsCampaignName),
        lastMetaAdsCampaignAt: String(data?.createdAt || new Date().toISOString()),
        lastMetaAdsCampaignStatus: String(data?.status || 'draft_created'),
      }));

      setAdsManagerUrl(String(data?.adsManagerUrl || adsManagerUrl || ''));

      toast({
        title: 'Meta Ads campaign created',
        description: `Campaign draft created for ${promotedProductIds.length} product(s).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Meta Ads campaign failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setMetaAdsBusy(false);
    }
  };

  const enableDynamicProductAds = async () => {
    if (!storeId) return;
    setDynamicAdsBusy(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/meta/ads/dynamic/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId,
          audienceName: dynamicAudienceName,
          retargetingWindowDays: dynamicWindowDays,
          minimumEventCount: dynamicMinEvents,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to enable dynamic product ads');
      }

      setMetaCatalog((prev) => ({
        ...prev,
        dynamicProductAdsEnabled: true,
        dynamicProductAdsStatus: String(data?.status || 'enabled'),
        dynamicProductAdsAudienceName: String(data?.summary?.audienceName || dynamicAudienceName),
        dynamicProductAdsRetargetingWindowDays: Number(data?.summary?.retargetingWindowDays || dynamicWindowDays),
        dynamicProductAdsMinimumEventCount: Number(data?.summary?.minimumEventCount || dynamicMinEvents),
        lastDynamicProductAdsAt: String(data?.enabledAt || new Date().toISOString()),
      }));

      setAdsManagerUrl(String(data?.adsManagerUrl || adsManagerUrl || ''));

      toast({
        title: 'Dynamic product ads enabled',
        description: 'Retargeting audience settings were saved successfully.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Dynamic product ads failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDynamicAdsBusy(false);
    }
  };

  const statusBadgeClass = (status: SyncJobRow['status']) => {
    if (status === 'completed') return 'bg-green-100 text-green-800 hover:bg-green-100';
    if (status === 'failed') return 'bg-red-100 text-red-800 hover:bg-red-100';
    if (status === 'processing') return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    if (status === 'queued') return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    return 'bg-slate-100 text-slate-800 hover:bg-slate-100';
  };

  return (
    <AdminPageShell
      title="Marketplace Sync Center"
      description="Test channel connectivity and manually push product snapshots to enabled marketplaces."
      className="p-4 md:p-6"
      actions={(
        <Button asChild variant="outline">
          <Link to="/admin/profile">
            <Link2 className="h-4 w-4 mr-2" />
            Open Integrations In Profile
          </Link>
        </Button>
      )}
    >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Enabled Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : enabledIntegrations.length}</div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Products Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : products.length}</div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Sync Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : jobs.length}</div>
            </CardContent>
          </AdminPanel>
        </div>

        <AdminPanel className="mb-6">
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
        </AdminPanel>

        <AdminPanel className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle>Meta Catalog Sync</CardTitle>
            <CardDescription>
              Generate catalog feed and push the latest valid products for Facebook/Instagram commerce.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Catalog ID</p>
                <p className="font-medium">{metaCatalog.catalogId || 'Not set (configure in Store Profile)'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Facebook Page URL</p>
                <p className="font-medium break-all">{metaCatalog.facebookPageUrl || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Feed URL</p>
                <p className="font-medium break-all">{metaCatalog.catalogFeedUrl || `${API_URL}/meta/catalog/feed?storeId=${storeId || ''}`}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Sync</p>
                <p className="font-medium">{metaCatalog.lastCatalogSyncAt ? new Date(metaCatalog.lastCatalogSyncAt).toLocaleString() : 'Never'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Facebook Shop Status</p>
                <p className="font-medium">
                  {metaCatalog.facebookShopEnabled
                    ? (metaCatalog.facebookShopStatus || 'connected')
                    : 'Not connected'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Connected At</p>
                <p className="font-medium">
                  {metaCatalog.facebookShopConnectedAt
                    ? new Date(metaCatalog.facebookShopConnectedAt).toLocaleString()
                    : 'Not connected'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Instagram Shopping Status</p>
                <p className="font-medium">
                  {metaCatalog.instagramShoppingEnabled
                    ? (metaCatalog.instagramShoppingStatus || 'connected')
                    : 'Not connected'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Instagram Connected At</p>
                <p className="font-medium">
                  {metaCatalog.instagramShoppingConnectedAt
                    ? new Date(metaCatalog.instagramShoppingConnectedAt).toLocaleString()
                    : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!storeId}
                onClick={() => window.open(`${API_URL}/meta/catalog/feed?storeId=${storeId}`, '_blank', 'noopener,noreferrer')}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Open Feed
              </Button>
              <Button
                type="button"
                onClick={runMetaCatalogSync}
                disabled={metaSyncBusy || !storeId || !metaCatalog.catalogId}
              >
                {metaSyncBusy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Sync Meta Catalog
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={connectFacebookShop}
                disabled={shopConnectBusy || !storeId || !metaCatalog.catalogId || !metaCatalog.facebookPageUrl || !metaCatalog.lastCatalogSyncAt}
              >
                {shopConnectBusy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Connect Facebook Shop
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={connectInstagramShopping}
                disabled={instagramConnectBusy || !storeId || !metaCatalog.catalogId || !metaCatalog.facebookPageUrl || !metaCatalog.lastCatalogSyncAt}
              >
                {instagramConnectBusy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting IG...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Connect Instagram Shopping
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!shopOnboardingUrl}
                onClick={() => window.open(shopOnboardingUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Commerce Manager
              </Button>
            </div>
          </CardContent>
        </AdminPanel>

        <AdminPanel className="mb-6 border-indigo-200">
          <CardHeader>
            <CardTitle>Meta Ads Campaign</CardTitle>
            <CardDescription>
              Create a campaign draft from your synced catalog products and continue setup in Ads Manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Ad Account ID</p>
                <p className="font-medium">{metaCatalog.adAccountId || 'Not set (configure in Store Profile)'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Campaign</p>
                <p className="font-medium">{metaCatalog.lastMetaAdsCampaignName || 'None'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Campaign Status</p>
                <p className="font-medium">{metaCatalog.lastMetaAdsCampaignStatus || 'None'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Campaign At</p>
                <p className="font-medium">
                  {metaCatalog.lastMetaAdsCampaignAt
                    ? new Date(metaCatalog.lastMetaAdsCampaignAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="adsCampaignName">Campaign Name</Label>
                <Input
                  id="adsCampaignName"
                  value={adsCampaignName}
                  onChange={(e) => setAdsCampaignName(e.target.value)}
                  placeholder="Meta Product Campaign"
                />
              </div>
              <div>
                <Label htmlFor="adsObjective">Objective</Label>
                <select
                  id="adsObjective"
                  value={adsObjective}
                  onChange={(e) => setAdsObjective(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="SALES">Sales</option>
                  <option value="TRAFFIC">Traffic</option>
                  <option value="AWARENESS">Awareness</option>
                </select>
              </div>
              <div>
                <Label htmlFor="adsDailyBudget">Daily Budget (USD)</Label>
                <Input
                  id="adsDailyBudget"
                  type="number"
                  min={1}
                  value={adsDailyBudget}
                  onChange={(e) => setAdsDailyBudget(Number(e.target.value || 20))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={createMetaAdsCampaign}
                disabled={metaAdsBusy || !storeId || !metaCatalog.adAccountId || !metaCatalog.catalogId || !metaCatalog.pixelId}
              >
                {metaAdsBusy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating Campaign...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Create Meta Ads Campaign
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!adsManagerUrl}
                onClick={() => window.open(adsManagerUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Ads Manager
              </Button>
            </div>
          </CardContent>
        </AdminPanel>

        <AdminPanel className="mb-6 border-emerald-200">
          <CardHeader>
            <CardTitle>Dynamic Product Ads</CardTitle>
            <CardDescription>
              Configure retargeting audience rules for dynamic catalog ads using your existing campaign setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">
                  {metaCatalog.dynamicProductAdsEnabled
                    ? (metaCatalog.dynamicProductAdsStatus || 'enabled')
                    : 'Not enabled'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Enabled At</p>
                <p className="font-medium">
                  {metaCatalog.lastDynamicProductAdsAt
                    ? new Date(metaCatalog.lastDynamicProductAdsAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="dynamicAudienceName">Audience Name</Label>
                <Input
                  id="dynamicAudienceName"
                  value={dynamicAudienceName}
                  onChange={(e) => setDynamicAudienceName(e.target.value)}
                  placeholder="Recent Product Viewers"
                />
              </div>
              <div>
                <Label htmlFor="dynamicWindowDays">Retargeting Window (days)</Label>
                <Input
                  id="dynamicWindowDays"
                  type="number"
                  min={1}
                  max={180}
                  value={dynamicWindowDays}
                  onChange={(e) => setDynamicWindowDays(Number(e.target.value || 14))}
                />
              </div>
              <div>
                <Label htmlFor="dynamicMinEvents">Minimum Conversion Events</Label>
                <Input
                  id="dynamicMinEvents"
                  type="number"
                  min={1}
                  max={10000}
                  value={dynamicMinEvents}
                  onChange={(e) => setDynamicMinEvents(Number(e.target.value || 100))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={enableDynamicProductAds}
                disabled={dynamicAdsBusy || !storeId || !metaCatalog.adAccountId || !metaCatalog.catalogId || !metaCatalog.pixelId || !metaCatalog.lastMetaAdsCampaignId}
              >
                {dynamicAdsBusy ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Enable Dynamic Product Ads
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!adsManagerUrl}
                onClick={() => window.open(adsManagerUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Ads Manager
              </Button>
            </div>
          </CardContent>
        </AdminPanel>

        <div className="space-y-4 mb-6">
          {enabledIntegrations.length === 0 && (
            <AdminPanel>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No enabled marketplace channels found. Enable at least one integration in Store Profile first.
              </CardContent>
            </AdminPanel>
          )}

          {enabledIntegrations.map((integration) => {
            const result = testResults[integration.id];
            const canSync = Boolean(result && result.status === 'passed');
            const isAlibaba = integration.id.toLowerCase() === 'alibaba';
            const settings = getChannelSettings(integration);
            const lastSyncAt = settings.lastSuccessfulSyncAt || channelLastCompletedAt[integration.id] || '';

            return (
              <AdminPanel key={integration.id} className={isAlibaba ? 'border-amber-300' : ''}>
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
                  {lastSyncAt && (
                    <div className="text-xs text-muted-foreground">
                      Last successful sync: {new Date(lastSyncAt).toLocaleString()}
                    </div>
                  )}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm font-medium">Channel Sync Settings</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                      <div>
                        <Label>Sync Mode</Label>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={getChannelSettings(integration).syncMode === 'full' ? 'default' : 'outline'}
                            disabled={savingSettings === integration.id}
                            onClick={() => saveChannelSettings(integration.id, { syncMode: 'full' })}
                          >
                            Full
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={getChannelSettings(integration).syncMode === 'incremental' ? 'default' : 'outline'}
                            disabled={savingSettings === integration.id}
                            onClick={() => saveChannelSettings(integration.id, { syncMode: 'incremental' })}
                          >
                            Incremental
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Failure Handling</Label>
                        <div className="mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={getChannelSettings(integration).autoRetryFailed ? 'default' : 'outline'}
                            disabled={savingSettings === integration.id}
                            onClick={() =>
                              saveChannelSettings(integration.id, {
                                autoRetryFailed: !getChannelSettings(integration).autoRetryFailed,
                              })
                            }
                          >
                            {getChannelSettings(integration).autoRetryFailed ? 'Auto-Retry Enabled' : 'Enable Auto-Retry'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Required Field Mapping Template</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {AVAILABLE_MAPPING_FIELDS.map((field) => {
                          const active = getRequiredFields(integration).includes(field);
                          return (
                            <Button
                              key={`${integration.id}-${field}`}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              disabled={savingSettings === integration.id}
                              onClick={() => {
                                const current = getRequiredFields(integration);
                                const next = active
                                  ? current.filter((item) => item !== field)
                                  : [...current, field];
                                saveChannelSettings(integration.id, { requiredFields: next });
                              }}
                            >
                              {FIELD_LABELS[field] || field}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

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
                      variant="outline"
                      onClick={() => runPreSyncValidation(integration)}
                      disabled={validationBusy === integration.id || !!syncBusy}
                    >
                      {validationBusy === integration.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Run Validation
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => syncProductsToChannel(integration)}
                      disabled={
                        !canSync ||
                        syncBusy === integration.id ||
                        connectionBusy === integration.id ||
                        !validationReports[integration.id] ||
                        validationReports[integration.id].invalidCount > 0
                      }
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

                  {validationReports[integration.id] && (
                    <div className="rounded-md border p-3 text-sm space-y-1">
                      <div className="font-medium">
                        Pre-Sync Validation: {validationReports[integration.id].invalidCount === 0 ? 'Passed' : 'Failed'}
                      </div>
                      <div className="text-muted-foreground">
                        {validationReports[integration.id].validCount}/{validationReports[integration.id].total} valid
                        {validationReports[integration.id].invalidCount > 0
                          ? ` • ${validationReports[integration.id].invalidCount} invalid`
                          : ''}
                      </div>
                      {validationReports[integration.id].errorSamples.length > 0 && (
                        <div className="text-xs text-red-600 pt-1 space-y-0.5">
                          {validationReports[integration.id].errorSamples.map((error, index) => (
                            <div key={`${integration.id}-err-${index}`}>{error}</div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground pt-1">
                        {new Date(validationReports[integration.id].validatedAt).toLocaleString()}
                      </div>
                    </div>
                  )}

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
              </AdminPanel>
            );
          })}
        </div>

        <AdminPanel>
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
                      <div className="font-medium flex items-center gap-2">
                        {job.channelName}
                        <Badge className={statusBadgeClass(job.status)}>{job.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {job.totalProducts} products
                        {job.failedCount > 0 ? ` • ${job.failedCount} failed` : ''}
                      </div>
                      {job.failedReason && (
                        <div className="text-xs text-red-600 mt-1">{job.failedReason}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'failed' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={retryBusy === job.id || !!syncBusy}
                          onClick={() => retryFailedJob(job)}
                        >
                          {retryBusy === job.id ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Retrying
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                            </>
                          )}
                        </Button>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'Unknown time'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminMarketplaceSync;
