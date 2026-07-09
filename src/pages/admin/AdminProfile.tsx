import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, getDoc, getDocFromServer, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { consumePackageDraftForStore } from '@/lib/applyPackageDraft';
import { getAuth, multiFactor, TotpMultiFactorGenerator, type MultiFactorInfo, type TotpSecret } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import { mapGrabioInvoiceTemplateToFinance } from '@/lib/invoiceTemplateMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Upload, Store, Camera, Plus, X, Check, AlertCircle, Pencil, ImagePlus, Palette, GripVertical, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { StoreProfile, StorePage, MarketplaceIntegrationSetting, DropshippingPartnerSetting, AiModelPricingSetting } from '../../types/storeProfile';
import { generateSlug, checkSlugAvailability, isValidSlug, generateUniqueSlug } from '@/lib/slugify';
import { getSubscriptionTierName, hasComposedAccess } from '@/lib/subscriptionHelper';

type DomainDnsRecord = {
  type: string;
  name: string;
  value: string;
  status: 'verified' | 'pending';
};

type DomainStatusDetails = {
  domainStatus: 'active' | 'pending' | 'error';
  sslStatus: 'active' | 'pending' | 'error';
  dnsRecords: DomainDnsRecord[];
};

type AiCatalogModel = {
  id: string;
  label: string;
  provider: string;
  creditsPerUnit: number;
  unitLabel: string;
  costPerCreditUsd: number;
  active: boolean;
  description?: string;
};

const getFallbackDnsRecords = (domain: string): DomainDnsRecord[] => {
  if (!domain) return [];
  const parts = domain.split('.');
  const name = parts.length > 2 ? parts[0] : '@';
  return [{ type: 'CNAME', name, value: 'market-flow-7b074.web.app', status: 'pending' }];
};

const getStatusBadgeClass = (status: 'active' | 'pending' | 'error') => {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'error') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
};

type ProfileSectionId =
  | 'growth-seo'
  | 'invoice'
  | 'product-settings'
  | 'ai-api'
  | 'custom-domain'
  | 'mfa'
  | 'gdpr'
  | 'marketplace';

/** Fields saved from Profile — invoice, legal identity, and account ops only (not storefront builder). */
function buildProfileSavePayload(
  data: StoreProfile,
  storeId: string,
  ownerAuthUid: string,
): Record<string, unknown> {
  const displayName = String(data.name || '').trim();
  return {
    id: storeId,
    storeId,
    ownerId: ownerAuthUid,
    name: displayName,
    storeName: displayName,
    location: data.location,
    slug: data.slug,
    email: data.email,
    phone: data.phone,
    proEmail: data.proEmail,
    website: data.website,
    logo: data.logo,
    description: data.description,
    invoiceNumberPrefix: data.invoiceNumberPrefix,
    lastInvoiceNumber: data.lastInvoiceNumber,
    invoiceTemplate: data.invoiceTemplate,
    financeDocumentSettings: {
      invoiceTemplate: mapGrabioInvoiceTemplateToFinance(data.invoiceTemplate),
      primaryColor: data.templateColors?.primary,
      secondaryColor: data.templateColors?.secondary ?? data.templateColors?.highlight,
    },
    taxNumber: data.taxNumber,
    productCategories: data.productCategories,
    priceMultiplier: data.priceMultiplier,
    seoSettings: data.seoSettings,
    metaIntegrationSettings: data.metaIntegrationSettings,
    serviceCatalogSettings: data.serviceCatalogSettings,
    subscriptionBillingSettings: data.subscriptionBillingSettings,
    paymentGatewaySettings: data.paymentGatewaySettings,
    marketplaceIntegrations: data.marketplaceIntegrations,
    dropshippingPartners: data.dropshippingPartners,
    customDomain: data.customDomain,
    customDomainStatus: data.customDomainStatus,
    sslAutoProvisioningEnabled: data.sslAutoProvisioningEnabled,
    aiIntegrationSettings: data.aiIntegrationSettings,
    adminIpWhitelistEnabled: data.adminIpWhitelistEnabled,
    adminIpAllowlist: data.adminIpAllowlist,
    isPremium: data.isPremium ?? false,
    template: data.template || 'modern',
    status: data.status,
  };
}

type ProfileCollapsibleSectionProps = {
  id: ProfileSectionId;
  title: React.ReactNode;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function ProfileCollapsibleSection({
  id,
  title,
  description,
  open,
  onOpenChange,
  children,
}: ProfileCollapsibleSectionProps) {
  return (
    <AdminPanel className={open ? undefined : 'shadow-sm'}>
      <CardHeader className={open ? 'pb-3' : 'py-4'}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">{title}</CardTitle>
            <CardDescription className={open ? 'mt-1' : 'mt-0.5 line-clamp-1'}>
              {description}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor={`profile-section-${id}`} className="text-xs text-muted-foreground">
              {open ? 'Shown' : 'Hidden'}
            </Label>
            <Switch
              id={`profile-section-${id}`}
              checked={open}
              onCheckedChange={onOpenChange}
            />
          </div>
        </div>
      </CardHeader>
      {open ? children : null}
    </AdminPanel>
  );
}

const defaultProfile: StoreProfile = {
  name: '',
  description: '',
  location: '',
  website: '',
  slogan: '',
  aboutUs: '',
  mission: '',
  vision: '',
  phone: '',
  email: '',
  facebook: '',
  instagram: '',
  twitter: '',
  logo: '',
  status: 'online',
  marketplaceIntegrations: [
    { id: 'amazon', name: 'Amazon', enabled: false },
    { id: 'walmart', name: 'Walmart', enabled: false },
    { id: 'ebay', name: 'eBay', enabled: false },
    { id: 'etsy', name: 'Etsy', enabled: false },
    { id: 'alibaba', name: 'Alibaba', enabled: false },
  ],
  dropshippingPartners: [
    { id: 'in_house_dropship', name: 'In-house Dropshipping', enabled: false, notes: '' },
  ],
  productCategories: ['Food', 'Beverages', 'Desserts', 'Bakery', 'Manufactured Goods', 'Electronics', 'Clothing', 'Services', 'Package', 'Box', 'Bag', 'Other'],
  priceMultiplier: 2.5,
  paymentGatewaySettings: {
    whishEnabled: true,
    stripeEnabled: true,
    squareEnabled: false,
    omtEnabled: false,
    bobEnabled: false,
    paypalEnabled: false,
    bankTransferEnabled: false,
    cashOnDeliveryEnabled: true,
    preferredGateway: 'whish',
    squareLocationId: '',
    omtReceiverName: '',
    omtReceiverPhone: '',
    bobReceiverName: '',
    bobReceiverPhone: '',
  },
  seoSettings: {
    metaTitleSuffix: '',
    metaDescription: '',
    keywords: [],
    canonicalBaseUrl: '',
    robotsIndex: true,
    robotsFollow: true,
    robotsDisallowPaths: [],
    robotsCustomDirectives: '',
    ogImage: '',
    twitterHandle: '',
  },
  metaIntegrationSettings: {
    pixelEnabled: false,
    pixelId: '',
    facebookPageUrl: '',
    facebookAppId: '',
    catalogId: '',
    conversionApiToken: '',
    adAccountId: '',
  },
  serviceCatalogSettings: {
    allowServiceProducts: true,
    allowRecurringSubscriptions: true,
    defaultServiceBillingType: 'one-time',
    minimumServiceDurationMinutes: 30,
    defaultRenewalReminderDays: 7,
  },
  adminIpWhitelistEnabled: false,
  adminIpAllowlist: [],
  logoPosition: 'left',
  subscriptionBillingSettings: {
    autoRenewEnabled: true,
    retryFailedPayments: true,
    maxRetryAttempts: 3,
    renewalGraceDays: 7,
    invoiceLeadDays: 3,
    preferredRenewalGateway: 'whish',
  },
  sslAutoProvisioningEnabled: true,
  aiIntegrationSettings: {
    enabled: false,
    assistantAccessMode: 'owner-account',
    apiBaseUrl: '',
    apiKey: '',
    defaultModelId: '',
    modelPricing: [],
  },
};

const AdminProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const db = getFirestore();
  const [formData, setFormData] = useState<StoreProfile>(defaultProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [profileStoreId, setProfileStoreId] = useState<string | null>(null);

  const applyProfileToForm = (data: StoreProfile) => {
    setFormData({
      ...defaultProfile,
      ...data,
      name: data.name || data.storeName || defaultProfile.name,
      marketplaceIntegrations: data.marketplaceIntegrations && data.marketplaceIntegrations.length > 0
        ? data.marketplaceIntegrations
        : defaultProfile.marketplaceIntegrations,
      dropshippingPartners: data.dropshippingPartners && data.dropshippingPartners.length > 0
        ? data.dropshippingPartners
        : defaultProfile.dropshippingPartners,
      paymentGatewaySettings: {
        ...defaultProfile.paymentGatewaySettings,
        ...(data.paymentGatewaySettings || {}),
      },
      seoSettings: {
        ...defaultProfile.seoSettings,
        ...(data.seoSettings || {}),
      },
      metaIntegrationSettings: {
        ...defaultProfile.metaIntegrationSettings,
        ...(data.metaIntegrationSettings || {}),
      },
      serviceCatalogSettings: {
        ...defaultProfile.serviceCatalogSettings,
        ...(data.serviceCatalogSettings || {}),
      },
      subscriptionBillingSettings: {
        ...defaultProfile.subscriptionBillingSettings,
        ...(data.subscriptionBillingSettings || {}),
      },
      aiIntegrationSettings: {
        ...defaultProfile.aiIntegrationSettings,
        ...(data.aiIntegrationSettings || {}),
      },
    });
    setLogoPreview(data.logo || '');
  };

  const loadProfileFromFirestore = async (authUid: string, fromServer = false) => {
    const actualStoreId = await resolveStoreIdForAuthUser(authUid);
    setProfileStoreId(actualStoreId);
    const profileRef = doc(db, 'storeProfiles', actualStoreId);
    const profileSnap = fromServer
      ? await getDocFromServer(profileRef)
      : await getDoc(profileRef);
    if (profileSnap.exists()) {
      applyProfileToForm(profileSnap.data() as StoreProfile);
    } else {
      setFormData(defaultProfile);
      setLogoPreview('');
    }
    return actualStoreId;
  };

  // Load store profile from Firestore on mount / when store binding changes
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        if (cancelled) return;
        await loadProfileFromFirestore(user.id, true);
      } catch (err) {
        if (!cancelled) {
          setFormData(defaultProfile);
          setLogoPreview('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.storeId]);

  useEffect(() => {
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ storeId?: string }>).detail;
      if (!user?.id) return;
      if (detail?.storeId && profileStoreId && detail.storeId !== profileStoreId) return;
      void loadProfileFromFirestore(user.id, true).catch(() => undefined);
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
  }, [user?.id, profileStoreId]);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState<string>('');
  const [slugError, setSlugError] = useState<string>('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);
  const [newPageName, setNewPageName] = useState<string>('');
  const [isRegisteringDomain, setIsRegisteringDomain] = useState(false);
  const [isCheckingDomainStatus, setIsCheckingDomainStatus] = useState(false);
  const [domainStatusDetails, setDomainStatusDetails] = useState<DomainStatusDetails | null>(null);
  const [isSubmittingSitemap, setIsSubmittingSitemap] = useState(false);
  const [enrolledMfaFactors, setEnrolledMfaFactors] = useState<MultiFactorInfo[]>([]);
  const [isPreparingMfa, setIsPreparingMfa] = useState(false);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isExportingGdpr, setIsExportingGdpr] = useState(false);
  const [isRequestingGdprDelete, setIsRequestingGdprDelete] = useState(false);
  const [gdprDeleteConfirm, setGdprDeleteConfirm] = useState('');
  const [generatedPrivacyPolicy, setGeneratedPrivacyPolicy] = useState('');
  const [isLoadingAiCatalog, setIsLoadingAiCatalog] = useState(false);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [aiCatalog, setAiCatalog] = useState<AiCatalogModel[]>([]);
  const [aiCatalogUpdatedAt, setAiCatalogUpdatedAt] = useState('');
  const autoProvisionAttemptRef = useRef(0);
  const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

  const [openProfileSections, setOpenProfileSections] = useState<Partial<Record<ProfileSectionId, boolean>>>({});
  const isProfileSectionOpen = (id: ProfileSectionId) => Boolean(openProfileSections[id]);
  const setProfileSectionOpen = (id: ProfileSectionId, open: boolean) => {
    setOpenProfileSections((prev) => ({ ...prev, [id]: open }));
  };

  const refreshMfaStatus = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setEnrolledMfaFactors([]);
      return;
    }

    await currentUser.reload();
    const factors = multiFactor(currentUser).enrolledFactors || [];
    setEnrolledMfaFactors(factors);
  };

  const prepareTotpEnrollment = async () => {
    setIsPreparingMfa(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in to set up MFA.');

      await currentUser.reload();
      const mfaUser = multiFactor(currentUser);
      if ((mfaUser.enrolledFactors || []).length > 0) {
        setEnrolledMfaFactors(mfaUser.enrolledFactors);
        toast({ title: 'MFA already enabled', description: 'This account already has at least one MFA factor.' });
        return;
      }

      const session = await mfaUser.getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      const uri = secret.generateQrCodeUrl(currentUser.email || user?.email || 'admin', 'Grabio Admin');

      setTotpSecret(secret);
      setTotpUri(uri);
      setTotpCode('');
      toast({ title: 'Authenticator setup ready', description: 'Scan QR and enter your 6-digit code to finish.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to prepare MFA setup.';
      toast({ title: 'MFA setup failed', description: msg, variant: 'destructive' });
    } finally {
      setIsPreparingMfa(false);
    }
  };

  const enrollTotpMfa = async () => {
    setIsEnrollingMfa(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in to set up MFA.');
      if (!totpSecret) throw new Error('Start setup first to generate a secret.');

      const code = totpCode.trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter a valid 6-digit authenticator code.');

      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code);
      await multiFactor(currentUser).enroll(assertion, 'Authenticator App');

      setTotpSecret(null);
      setTotpUri('');
      setTotpCode('');
      await refreshMfaStatus();

      toast({ title: 'MFA enabled', description: 'TOTP MFA is now active for this admin account.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify and enable MFA.';
      toast({ title: 'MFA enrollment failed', description: msg, variant: 'destructive' });
    } finally {
      setIsEnrollingMfa(false);
    }
  };

  const disableTotpMfa = async () => {
    setIsDisablingMfa(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in to manage MFA.');

      const factors = multiFactor(currentUser).enrolledFactors || [];
      if (factors.length === 0) throw new Error('No MFA factor is enrolled on this account.');

      await multiFactor(currentUser).unenroll(factors[0]);
      await refreshMfaStatus();
      setTotpSecret(null);
      setTotpUri('');
      setTotpCode('');

      toast({ title: 'MFA disabled', description: 'Authenticator MFA has been removed from this account.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable MFA.';
      toast({ title: 'Disable MFA failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDisablingMfa(false);
    }
  };

  const handleGdprExport = async () => {
    setIsExportingGdpr(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in.');

      const token = await currentUser.getIdToken();
      const storeId = getActualStoreId(user!);
      const response = await fetch(`${API_URL}/gdpr/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'GDPR export failed');

      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gdpr-export-${storeId}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({ title: 'GDPR export ready', description: 'Your data export file was generated and downloaded.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export GDPR data.';
      toast({ title: 'GDPR export failed', description: msg, variant: 'destructive' });
    } finally {
      setIsExportingGdpr(false);
    }
  };

  const handleGdprDeleteRequest = async () => {
    if (gdprDeleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast({ title: 'Confirmation required', description: 'Type DELETE to confirm account deletion request.', variant: 'destructive' });
      return;
    }

    setIsRequestingGdprDelete(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in.');

      const token = await currentUser.getIdToken();
      const storeId = getActualStoreId(user!);
      const response = await fetch(`${API_URL}/gdpr/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId, confirmDelete: true }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'GDPR delete request failed');

      toast({ title: 'Deletion request submitted', description: 'Your GDPR deletion request is now pending.' });
      setGdprDeleteConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit deletion request.';
      toast({ title: 'Deletion request failed', description: msg, variant: 'destructive' });
    } finally {
      setIsRequestingGdprDelete(false);
    }
  };

  const generatePrivacyPolicyText = () => {
    const storeName = formData.name || 'Your Store';
    const contactEmail = formData.email || 'support@example.com';
    const contactPhone = formData.phone || '';
    const website = formData.website || `https://grabio.space/${formData.slug || ''}`;
    const today = new Date().toISOString().slice(0, 10);

    const policy = [
      `${storeName} Privacy Policy`,
      `Last updated: ${today}`,
      '',
      '1. Information We Collect',
      '- Account information (name, email, phone, address).',
      '- Order and transaction data needed to process purchases.',
      '- Device and usage information for security and analytics.',
      '',
      '2. How We Use Information',
      '- Process and fulfill orders.',
      '- Provide customer support and service updates.',
      '- Improve store performance, security, and user experience.',
      '',
      '3. Data Sharing',
      '- We share only what is necessary with payment, delivery, and technical service providers.',
      '- We do not sell personal data.',
      '',
      '4. Data Retention',
      '- We retain personal data only as long as needed for business, legal, and compliance requirements.',
      '',
      '5. Your Rights',
      '- Request access to your personal data.',
      '- Request correction or deletion of personal data where applicable.',
      '- Request data export in a portable format.',
      '',
      '6. Contact',
      `- Email: ${contactEmail}`,
      ...(contactPhone ? [`- Phone: ${contactPhone}`] : []),
      `- Website: ${website}`,
    ].join('\n');

    setGeneratedPrivacyPolicy(policy);
  };

  const downloadPrivacyPolicy = () => {
    if (!generatedPrivacyPolicy.trim()) {
      toast({ title: 'No policy generated', description: 'Generate the policy first.', variant: 'destructive' });
      return;
    }

    const fileName = `${(formData.name || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-privacy-policy.txt`;
    const blob = new Blob([generatedPrivacyPolicy], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshMfaStatus().catch(() => setEnrolledMfaFactors([]));
      return;
    }
    setEnrolledMfaFactors([]);
  }, [user?.id, user?.role]);

  const robotsTxtPreview = (() => {
    const slugPrefix = formData.slug ? `/${String(formData.slug).trim().replace(/^\/+|\/+$/g, '')}` : '';
    const disallowPaths = (formData.seoSettings?.robotsDisallowPaths || [])
      .map((path) => String(path || '').trim())
      .filter((path) => path.length > 0)
      .map((path) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return slugPrefix ? `${slugPrefix}${normalized}` : normalized;
      });

    const customDirectives = String(formData.seoSettings?.robotsCustomDirectives || '').trim();
    const lines = [
      'User-agent: *',
      'Allow: /',
      ...disallowPaths.map((path) => `Disallow: ${path}`),
      'Sitemap: https://grabio.space/sitemap.xml',
      ...(customDirectives ? ['', customDirectives] : []),
    ];
    return lines.join('\n');
  })();

  const handleCopyRobotsTxt = async () => {
    try {
      await navigator.clipboard.writeText(robotsTxtPreview);
      toast({ title: 'Copied', description: 'robots.txt preview copied to clipboard.' });
    } catch (_err) {
      toast({ title: 'Copy failed', description: 'Could not copy robots.txt preview.', variant: 'destructive' });
    }
  };

  const handleSitemapSubmission = async () => {
    const storeId = getActualStoreId(user);
    if (!storeId) {
      toast({ title: 'Store not found', description: 'Please refresh and try again.', variant: 'destructive' });
      return;
    }

    setIsSubmittingSitemap(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/seo/sitemap/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit sitemap');
      }

      const successCount = Number(data?.summary?.successCount || 0);
      const total = Number(data?.summary?.total || 0);
      toast({
        title: 'Sitemap submitted',
        description: `Submission finished (${successCount}/${total} successful).`,
      });

      setFormData((prev) => ({
        ...prev,
        seoSettings: {
          ...(prev.seoSettings || {}),
          lastSitemapSubmission: {
            submittedAt: String(data?.submittedAt || new Date().toISOString()),
            sitemapUrl: String(data?.sitemapUrl || ''),
            results: Array.isArray(data?.results) ? data.results : [],
          },
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Sitemap submission failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingSitemap(false);
    }
  };

  const upsertAiModelPricing = (model: AiCatalogModel) => {
    setFormData((prev) => {
      const current = prev.aiIntegrationSettings?.modelPricing || [];
      const existingIndex = current.findIndex((item) => item.modelId === model.id);
      const nextEntry: AiModelPricingSetting = {
        modelId: model.id,
        label: model.label,
        provider: model.provider,
        creditsPerUnit: model.creditsPerUnit,
        unitLabel: model.unitLabel,
        costPerCreditUsd: Number(model.costPerCreditUsd || 0),
        active: Boolean(model.active),
      };

      const nextPricing = existingIndex >= 0
        ? current.map((item, index) => (index === existingIndex ? { ...item, ...nextEntry } : item))
        : [...current, nextEntry];

      return {
        ...prev,
        aiIntegrationSettings: {
          ...(prev.aiIntegrationSettings || {}),
          assistantAccessMode: 'owner-account',
          modelPricing: nextPricing,
        },
      };
    });
  };

  const handleLoadAiCatalog = async () => {
    setIsLoadingAiCatalog(true);
    try {
      const storeId = getActualStoreId(user);
      if (!storeId) throw new Error('Store not found.');

      const response = await fetch(`${API_URL}/ai/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Failed to load model catalog.');

      const models = Array.isArray(payload.models) ? payload.models as AiCatalogModel[] : [];
      setAiCatalog(models);
      setAiCatalogUpdatedAt(String(payload.updatedAt || new Date().toISOString()));

      models.forEach((model) => upsertAiModelPricing(model));

      toast({
        title: 'AI catalog loaded',
        description: `${models.length} models loaded with credit cost information.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'AI catalog failed', description: message, variant: 'destructive' });
    } finally {
      setIsLoadingAiCatalog(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setIsSavingAiSettings(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('You must be signed in.');

      const storeId = getActualStoreId(user);
      if (!storeId) throw new Error('Store not found.');

      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/ai/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId,
          aiIntegrationSettings: {
            ...(formData.aiIntegrationSettings || {}),
            assistantAccessMode: 'owner-account',
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Failed to save AI settings.');

      setFormData((prev) => ({
        ...prev,
        aiIntegrationSettings: {
          ...(prev.aiIntegrationSettings || {}),
          ...(payload.aiIntegrationSettings || {}),
          assistantAccessMode: 'owner-account',
        },
      }));

      toast({ title: 'AI settings saved', description: 'API integration and model credit pricing were saved.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const applyDomainStatusPayload = (data: unknown): 'active' | 'pending' | 'error' => {
    const payload = (data || {}) as {
      status?: string;
      details?: DomainStatusDetails;
    };

    const status: 'active' | 'pending' | 'error' = payload.status === 'active' || payload.status === 'error'
      ? payload.status
      : 'pending';

    setFormData(prev => ({
      ...prev,
      customDomainStatus: status,
    }));

    const details = payload.details;
    if (details && Array.isArray(details.dnsRecords)) {
      setDomainStatusDetails({
        domainStatus: details.domainStatus === 'active' || details.domainStatus === 'error' ? details.domainStatus : 'pending',
        sslStatus: details.sslStatus === 'active' || details.sslStatus === 'error' ? details.sslStatus : 'pending',
        dnsRecords: details.dnsRecords,
      });
    } else {
      setDomainStatusDetails(null);
    }

    return status;
  };

  const handleCheckDomainStatus = async (silent = false): Promise<'active' | 'pending' | 'error' | null> => {
    if (!formData.customDomain) return null;
    if (!silent) setIsCheckingDomainStatus(true);

    try {
      const storeId = getActualStoreId(user!);
      const res = await fetch(`${API_URL}/domain/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, customDomain: formData.customDomain }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status check failed');

      const status = applyDomainStatusPayload(data);
      if (!silent) {
        toast({
          title: 'Domain status updated',
          description: `Current status: ${status}`,
        });
      }
      return status;
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast({ title: 'Status check failed', description: msg, variant: 'destructive' });
      }
      return null;
    } finally {
      if (!silent) setIsCheckingDomainStatus(false);
    }
  };

  const handleRegisterDomain = async (silent = false): Promise<boolean> => {
    if (!formData.customDomain) return false;
    if (!silent) setIsRegisteringDomain(true);

    try {
      const storeId = getActualStoreId(user!);
      const res = await fetch(`${API_URL}/domain/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, customDomain: formData.customDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setFormData(prev => ({ ...prev, customDomainStatus: 'pending' }));
      setDomainStatusDetails(null);
      if (!silent) {
        toast({ title: 'Domain submitted', description: 'Status is pending — SSL provisioning will continue automatically.' });
      }
      return true;
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast({ title: 'Registration failed', description: msg, variant: 'destructive' });
      }
      return false;
    } finally {
      if (!silent) setIsRegisteringDomain(false);
    }
  };

  useEffect(() => {
    if (!formData.customDomain || !formData.sslAutoProvisioningEnabled) return;
    if (formData.customDomainStatus === 'active') return;

    const interval = setInterval(async () => {
      if (isCheckingDomainStatus || isRegisteringDomain) return;

      const status = await handleCheckDomainStatus(true);
      if (!status || status === 'active') return;

      autoProvisionAttemptRef.current += 1;
      const shouldRetryRegistration = status === 'error' || autoProvisionAttemptRef.current % 5 === 0;
      if (shouldRetryRegistration) {
        await handleRegisterDomain(true);
      }
    }, 90_000);

    return () => clearInterval(interval);
  }, [
    formData.customDomain,
    formData.customDomainStatus,
    formData.sslAutoProvisioningEnabled,
    isCheckingDomainStatus,
    isRegisteringDomain,
  ]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setFormData(prev => ({ ...prev, logo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Banner / carousel image helpers
  const handleAddCarouselImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          carouselImages: [...(prev.carouselImages || []), result],
        }));
      };
      reader.readAsDataURL(file);
    });
    // Reset input so same file can be added again if needed
    event.target.value = '';
  };

  const handleRemoveCarouselImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      carouselImages: (prev.carouselImages || []).filter((_, i) => i !== index),
    }));
  };

  // Custom page helpers
  const handleAddPage = () => {
    const name = newPageName.trim();
    if (!name) return;
    const pages = formData.customPages || [];
    const newPage: StorePage = {
      id: `page-${Date.now()}`,
      name,
      order: pages.length,
    };
    setFormData(prev => ({ ...prev, customPages: [...(prev.customPages || []), newPage] }));
    setNewPageName('');
  };

  const handleRemovePage = (id: string) => {
    setFormData(prev => ({
      ...prev,
      customPages: (prev.customPages || []).filter(p => p.id !== id).map((p, i) => ({ ...p, order: i })),
    }));
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    const pages = [...(formData.customPages || [])];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    setFormData(prev => ({ ...prev, customPages: pages.map((p, i) => ({ ...p, order: i })) }));
  };

  const handlePageNameChange = (id: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      customPages: (prev.customPages || []).map(p => p.id === id ? { ...p, name } : p),
    }));
  };

  const handlePageContentChange = (id: string, content: string) => {
    setFormData(prev => ({
      ...prev,
      customPages: (prev.customPages || []).map(p => p.id === id ? { ...p, content } : p),
    }));
  };

  const handlePageImageChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setFormData(prev => ({
        ...prev,
        customPages: (prev.customPages || []).map(p => p.id === id ? { ...p, image: result } : p),
      }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemovePageImage = (id: string) => {
    setFormData(prev => ({
      ...prev,
      customPages: (prev.customPages || []).map(p => p.id === id ? { ...p, image: undefined } : p),
    }));
  };

  const updateMarketplaceIntegration = (id: string, field: keyof MarketplaceIntegrationSetting, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      marketplaceIntegrations: (prev.marketplaceIntegrations || []).map((integration) =>
        integration.id === id ? { ...integration, [field]: value } : integration
      ),
    }));
  };

  const addDropshippingPartner = () => {
    const newPartner: DropshippingPartnerSetting = {
      id: `dropship-${Date.now()}`,
      name: 'New Dropshipping Partner',
      enabled: true,
      contactEmail: '',
      webhookUrl: '',
      notes: '',
    };

    setFormData(prev => ({
      ...prev,
      dropshippingPartners: [...(prev.dropshippingPartners || []), newPartner],
    }));
  };

  const updateDropshippingPartner = (id: string, field: keyof DropshippingPartnerSetting, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      dropshippingPartners: (prev.dropshippingPartners || []).map((partner) =>
        partner.id === id ? { ...partner, [field]: value } : partner
      ),
    }));
  };

  const removeDropshippingPartner = (id: string) => {
    setFormData(prev => ({
      ...prev,
      dropshippingPartners: (prev.dropshippingPartners || []).filter((partner) => partner.id !== id),
    }));
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !formData.productCategories?.includes(newCategory.trim())) {
      setFormData({
        ...formData,
        productCategories: [...(formData.productCategories || []), newCategory.trim()]
      });
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (category: string) => {
    setFormData({
      ...formData,
      productCategories: formData.productCategories?.filter(c => c !== category) || []
    });
  };

  const handleStartEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditCategoryValue(category);
  };

  const handleSaveEditCategory = () => {
    if (editCategoryValue.trim() && editingCategory) {
      const categories = formData.productCategories || [];
      const index = categories.indexOf(editingCategory);
      if (index !== -1 && !categories.includes(editCategoryValue.trim())) {
        const updatedCategories = [...categories];
        updatedCategories[index] = editCategoryValue.trim();
        setFormData({
          ...formData,
          productCategories: updatedCategories
        });
      }
      setEditingCategory(null);
      setEditCategoryValue('');
    }
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryValue('');
  };

  const handleSlugChange = async (value: string) => {
    const newSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setFormData({ ...formData, slug: newSlug });
    
    if (!newSlug || newSlug.length < 2) {
      setSlugError('');
      setSlugAvailable(false);
      return;
    }
    
    if (!isValidSlug(newSlug)) {
      setSlugError('Invalid slug format. Use lowercase letters, numbers, and hyphens only.');
      setSlugAvailable(false);
      return;
    }
    
    setIsCheckingSlug(true);
    try {
      const result = await checkSlugAvailability(newSlug, 'storeProfiles', user?.id);
      if (result.available) {
        setSlugError('');
        setSlugSuggestions([]);
        setSlugAvailable(true);
      } else {
        setSlugError('This store name is already taken. Choose another one:');
        setSlugSuggestions(result.suggestions);
        setSlugAvailable(false);
      }
    } catch (err) {
      setSlugError('Failed to check availability');
      setSlugAvailable(false);
    }
    setIsCheckingSlug(false);
  };

  const handleGenerateSlug = () => {
    if (formData.name) {
      const slug = generateSlug(formData.name);
      handleSlugChange(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    if (user?.id) {
      try {
        const actualStoreId = await resolveStoreIdForAuthUser(user.id);
        setProfileStoreId(actualStoreId);
        if (!actualStoreId) {
          throw new Error('Missing store id');
        }
        let nextSlug = formData.slug;
        if (!nextSlug && formData.name) {
          nextSlug = await generateUniqueSlug(formData.name, 'storeProfiles', actualStoreId);
          setFormData((prev) => ({ ...prev, slug: nextSlug }));
        }

        const payload = buildProfileSavePayload({ ...formData, slug: nextSlug }, actualStoreId, user.id);
        if (!payload.slug && payload.name) {
          payload.slug = await generateUniqueSlug(String(payload.name), 'storeProfiles', actualStoreId);
        }
        const profileRef = doc(db, 'storeProfiles', actualStoreId);
        const existingSnap = await getDoc(profileRef);
        const existingProfile = existingSnap.exists()
          ? (existingSnap.data() as StoreProfile)
          : null;
        const existingFinance = (existingProfile as StoreProfile & { financeDocumentSettings?: Record<string, unknown> })?.financeDocumentSettings ?? {};
        const ecosystemPatch = consumePackageDraftForStore(existingProfile);
        const displayName = String(formData.name || '').trim();
        const mergedFinance = {
          ...existingFinance,
          ...(payload.financeDocumentSettings as Record<string, unknown>),
        };

        // 1) Small identity write first (reliable for invoices/PDFs)
        const identityPatch: Record<string, unknown> = {
          ownerId: user.id,
          name: displayName,
          storeName: displayName,
          location: formData.location || '',
          email: formData.email || '',
          phone: formData.phone || '',
          website: formData.website || '',
          proEmail: formData.proEmail || '',
          taxNumber: formData.taxNumber || '',
          invoiceNumberPrefix: formData.invoiceNumberPrefix || '',
          lastInvoiceNumber: formData.lastInvoiceNumber ?? 0,
          invoiceTemplate: formData.invoiceTemplate || 'modern',
          financeDocumentSettings: mergedFinance,
          updatedAt: serverTimestamp(),
        };
        if (logoFile && formData.logo) {
          identityPatch.logo = formData.logo;
        }
        await updateDoc(profileRef, identityPatch);

        // 2) Full profile merge (skip logo unless newly uploaded)
        const fullPayload = { ...payload, ...ecosystemPatch, financeDocumentSettings: mergedFinance, updatedAt: serverTimestamp() };
        if (!logoFile) {
          delete fullPayload.logo;
        }
        await setDoc(profileRef, fullPayload, { merge: true });
        // Persist storeId in sellers collection and localStorage
        const sellerRef = doc(db, 'sellers', user.id);
        await setDoc(sellerRef, { storeId: actualStoreId }, { merge: true });
        // Update localStorage
        const savedSellerInfo = localStorage.getItem('sellerInfo');
  const sellerInfo = savedSellerInfo ? JSON.parse(savedSellerInfo) : {};
  sellerInfo.storeId = actualStoreId;
  localStorage.setItem('sellerInfo', JSON.stringify(sellerInfo));
        // Update user context with storeId
        if (setUser) setUser((prev) => prev ? { ...prev, storeId: actualStoreId } : prev);
        window.dispatchEvent(new CustomEvent('grabio:store-profile-updated', { detail: { storeId: actualStoreId } }));
        const refreshedSnap = await getDocFromServer(profileRef);
        if (refreshedSnap.exists()) {
          const saved = refreshedSnap.data() as StoreProfile;
          if (displayName && saved.name !== displayName && saved.storeName !== displayName) {
            throw new Error(
              `Save did not stick on server (still "${saved.name || saved.storeName || 'empty'}"). Refresh and try again.`,
            );
          }
          applyProfileToForm(saved);
        }
        setLogoFile(null);
        toast({
          title: "Success",
          description: "Profile saved. Invoice Manager will pick up changes automatically.",
        });
      } catch (err) {
        console.error('[AdminProfile] save failed', err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to update store profile.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Error",
        description: "User not found. Please log in again.",
        variant: "destructive"
      });
    }
    setIsSaving(false);
  };

  return (
    <AdminPageShell
      title="Business & Invoice Settings"
      description="Legal identity, contact details, and invoice/document appearance. Storefront design is in Theme Editor."
      eyebrow="Profile & Documents"
      className="max-w-6xl mx-auto"
    >
        <AdminPanel className="mb-6 border border-[#e3e3e5] bg-muted/30">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Storefront pages &amp; theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Homepage sections, colors, and store copy — Theme Editor (requires Builder module).
                Invoice logo and template are in <strong>Invoice Settings</strong> below.
              </p>
            </div>
            <Button type="button" variant="default" onClick={() => navigate('/admin/theme-editor')}>
              Open Theme Editor
            </Button>
          </CardContent>
        </AdminPanel>

        {/* Subscription Card */}
        <AdminPanel className="mb-6 border-2 border-primary">
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>
              Your current subscription tier and features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold mb-1">{getSubscriptionTierName(formData)}</div>
                <div className="text-sm text-gray-600">
                  {hasComposedAccess(formData) ? (
                    <span className="text-green-600">✓ Includes manufacturing, production, finished goods, raw materials and POS</span>
                  ) : (
                    <span className="text-amber-600">Basic features only</span>
                  )}
                </div>
              </div>
              <Button 
                type="button"
                variant={hasComposedAccess(formData) ? "outline" : "default"}
                onClick={() => navigate('/subscription')}
              >
                {hasComposedAccess(formData) ? 'Manage Plan' : 'Choose Plan'}
              </Button>
            </div>
          </CardContent>
        </AdminPanel>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business identity (invoices & documents) */}
          <AdminPanel>
            <CardHeader>
              <CardTitle>Business Identity</CardTitle>
              <CardDescription>
                Name and address shown on invoices and official documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Store Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, name: e.target.value }));
                      // Auto-generate slug on name change if slug is empty
                      if (!formData.slug) {
                        const slug = generateSlug(e.target.value);
                        handleSlugChange(slug);
                      }
                    }}
                    placeholder="Your store name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State/Country"
                  />
                </div>
              </div>
              
              {/* Store Slug/URL */}
              <div>
                <Label htmlFor="slug">
                  Store URL *
                  <span className="text-xs text-muted-foreground ml-2">
                    (This will be your store's web address)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Input
                        id="slug"
                        value={formData.slug || ''}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        placeholder="your-store-name"
                        required
                        className={slugError ? 'border-red-500' : slugAvailable && formData.slug ? 'border-green-500' : ''}
                      />
                      {isCheckingSlug && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                        </div>
                      )}
                      {!isCheckingSlug && slugAvailable && formData.slug && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {!isCheckingSlug && slugError && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      https://grabio.space/{formData.slug || 'your-store-name'}
                    </p>
                    {slugError && (
                      <div className="mt-2">
                        <p className="text-xs text-red-500 mb-2">{slugError}</p>
                        {slugSuggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {slugSuggestions.map((suggestion) => (
                              <Badge
                                key={suggestion}
                                variant="outline"
                                className="cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSlugChange(suggestion)}
                              >
                                {suggestion}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateSlug}
                    disabled={!formData.name}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://your-website.com"
                />
              </div>
            </CardContent>
          </AdminPanel>

          {/* Contact Information */}
          <AdminPanel>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Contact details printed on invoices and business documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@yourstore.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="proEmail">Pro Email <span className="text-xs text-muted-foreground ml-1">(receives Contact Us messages)</span></Label>
                <Input
                  id="proEmail"
                  name="proEmail"
                  type="email"
                  autoComplete="off"
                  value={formData.proEmail || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, proEmail: e.target.value }))}
                  placeholder="orders@yourstore.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Messages from the store Contact Us page will be forwarded to this email.</p>
              </div>
            </CardContent>
          </AdminPanel>

          <p className="text-sm text-slate-500 px-1">
            Optional sections below start collapsed. Toggle <span className="font-medium">Hidden / Shown</span> on each card to expand.
          </p>

          <ProfileCollapsibleSection
            id="growth-seo"
            title="Growth, SEO & Subscription Controls"
            description="Discoverability, Meta/Facebook data, service policy, and billing defaults"
            open={isProfileSectionOpen('growth-seo')}
            onOpenChange={(open) => setProfileSectionOpen('growth-seo', open)}
          >
            <CardContent className="space-y-6 pt-0">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">SEO Basics</h4>
                <div>
                  <Label htmlFor="seoMetaDescription">Meta Description Override</Label>
                  <Textarea
                    id="seoMetaDescription"
                    value={formData.seoSettings?.metaDescription || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      seoSettings: {
                        ...(prev.seoSettings || {}),
                        metaDescription: e.target.value,
                      },
                    }))}
                    placeholder="Short store summary used in search engines"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="seoTitleSuffix">Meta Title Suffix</Label>
                    <Input
                      id="seoTitleSuffix"
                      value={formData.seoSettings?.metaTitleSuffix || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          metaTitleSuffix: e.target.value,
                        },
                      }))}
                      placeholder="e.g. | Premium Food in Beirut"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seoCanonicalBaseUrl">Canonical URL (optional)</Label>
                    <Input
                      id="seoCanonicalBaseUrl"
                      value={formData.seoSettings?.canonicalBaseUrl || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          canonicalBaseUrl: e.target.value,
                        },
                      }))}
                      placeholder="https://yourdomain.com/store"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="seoKeywords">SEO Keywords (comma separated)</Label>
                  <Input
                    id="seoKeywords"
                    value={(formData.seoSettings?.keywords || []).join(', ')}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      seoSettings: {
                        ...(prev.seoSettings || {}),
                        keywords: e.target.value
                          .split(',')
                          .map((keyword) => keyword.trim())
                          .filter((keyword) => keyword.length > 0),
                      },
                    }))}
                    placeholder="food delivery, bakery, beirut"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="robotsIndex">Allow search indexing</Label>
                    <Switch
                      id="robotsIndex"
                      checked={formData.seoSettings?.robotsIndex ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          robotsIndex: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="robotsFollow">Allow links to be followed</Label>
                    <Switch
                      id="robotsFollow"
                      checked={formData.seoSettings?.robotsFollow ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          robotsFollow: checked,
                        },
                      }))}
                    />
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <p className="text-sm font-medium">Robots.txt Management</p>
                  <div>
                    <Label htmlFor="robotsDisallowPaths">Disallow Paths (one per line)</Label>
                    <Textarea
                      id="robotsDisallowPaths"
                      rows={3}
                      value={(formData.seoSettings?.robotsDisallowPaths || []).join('\n')}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          robotsDisallowPaths: e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0),
                        },
                      }))}
                      placeholder="/admin\n/private"
                    />
                  </div>
                  <div>
                    <Label htmlFor="robotsCustomDirectives">Custom Directives (optional)</Label>
                    <Textarea
                      id="robotsCustomDirectives"
                      rows={4}
                      value={formData.seoSettings?.robotsCustomDirectives || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        seoSettings: {
                          ...(prev.seoSettings || {}),
                          robotsCustomDirectives: e.target.value,
                        },
                      }))}
                      placeholder="User-agent: AdsBot-Google\nDisallow: /"
                    />
                  </div>
                  <div>
                    <Label htmlFor="robotsPreview">Preview</Label>
                    <Textarea id="robotsPreview" rows={7} value={robotsTxtPreview} readOnly className="font-mono text-xs" />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={handleCopyRobotsTxt}>Copy robots.txt</Button>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Sitemap Submission</p>
                    <p className="text-xs text-muted-foreground">
                      Notify search engines after major catalog updates.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSitemapSubmission}
                      disabled={isSubmittingSitemap}
                    >
                      {isSubmittingSitemap ? 'Submitting sitemap...' : 'Submit Sitemap to Search Engines'}
                    </Button>
                    {formData.seoSettings?.lastSitemapSubmission?.submittedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last submitted: {new Date(formData.seoSettings.lastSitemapSubmission.submittedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Meta/Facebook Integration</h4>
                <div className="flex items-center justify-between border rounded-md px-3 py-2">
                  <Label htmlFor="metaPixelEnabled">Enable Meta Pixel for this store</Label>
                  <Switch
                    id="metaPixelEnabled"
                    checked={formData.metaIntegrationSettings?.pixelEnabled ?? false}
                    onCheckedChange={(checked) => setFormData((prev) => ({
                      ...prev,
                      metaIntegrationSettings: {
                        ...(prev.metaIntegrationSettings || {}),
                        pixelEnabled: checked,
                      },
                    }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="metaPixelId">Meta Pixel ID</Label>
                    <Input
                      id="metaPixelId"
                      value={formData.metaIntegrationSettings?.pixelId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          pixelId: e.target.value,
                        },
                      }))}
                      placeholder="123456789012345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebookAppId">Facebook App ID</Label>
                    <Input
                      id="facebookAppId"
                      value={formData.metaIntegrationSettings?.facebookAppId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          facebookAppId: e.target.value,
                        },
                      }))}
                      placeholder="Facebook App ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebookPageUrl">Facebook Page URL</Label>
                    <Input
                      id="facebookPageUrl"
                      value={formData.metaIntegrationSettings?.facebookPageUrl || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          facebookPageUrl: e.target.value,
                        },
                      }))}
                      placeholder="https://facebook.com/yourstore"
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebookCatalogId">Facebook Catalog ID</Label>
                    <Input
                      id="facebookCatalogId"
                      value={formData.metaIntegrationSettings?.catalogId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          catalogId: e.target.value,
                        },
                      }))}
                      placeholder="Catalog ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metaAdAccountId">Meta Ad Account ID</Label>
                    <Input
                      id="metaAdAccountId"
                      value={formData.metaIntegrationSettings?.adAccountId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          adAccountId: e.target.value,
                        },
                      }))}
                      placeholder="123456789012345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metaConversionApiToken">Meta Conversion API Token</Label>
                    <Input
                      id="metaConversionApiToken"
                      type="password"
                      value={formData.metaIntegrationSettings?.conversionApiToken || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        metaIntegrationSettings: {
                          ...(prev.metaIntegrationSettings || {}),
                          conversionApiToken: e.target.value,
                        },
                      }))}
                      placeholder="EAAB..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="metaLastConversionEvent">Last Conversion Event</Label>
                    <Input
                      id="metaLastConversionEvent"
                      value={formData.metaIntegrationSettings?.lastConversionEventName || 'No events yet'}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="metaLastConversionAt">Last Conversion Timestamp</Label>
                    <Input
                      id="metaLastConversionAt"
                      value={formData.metaIntegrationSettings?.lastConversionEventAt ? new Date(formData.metaIntegrationSettings.lastConversionEventAt).toLocaleString() : 'No events yet'}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Service & Subscription Billing Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="allowServiceProducts">Allow service products</Label>
                    <Switch
                      id="allowServiceProducts"
                      checked={formData.serviceCatalogSettings?.allowServiceProducts ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        serviceCatalogSettings: {
                          ...(prev.serviceCatalogSettings || {}),
                          allowServiceProducts: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="allowRecurringSubscriptions">Allow recurring service billing</Label>
                    <Switch
                      id="allowRecurringSubscriptions"
                      checked={formData.serviceCatalogSettings?.allowRecurringSubscriptions ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        serviceCatalogSettings: {
                          ...(prev.serviceCatalogSettings || {}),
                          allowRecurringSubscriptions: checked,
                        },
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="defaultServiceBillingType">Default Service Billing Type</Label>
                    <select
                      id="defaultServiceBillingType"
                      value={formData.serviceCatalogSettings?.defaultServiceBillingType || 'one-time'}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        serviceCatalogSettings: {
                          ...(prev.serviceCatalogSettings || {}),
                          defaultServiceBillingType: e.target.value as 'one-time' | 'monthly' | 'yearly',
                        },
                      }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="one-time">One-time</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="minimumServiceDurationMinutes">Minimum Service Duration (minutes)</Label>
                    <Input
                      id="minimumServiceDurationMinutes"
                      type="number"
                      min="5"
                      value={formData.serviceCatalogSettings?.minimumServiceDurationMinutes ?? 30}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        serviceCatalogSettings: {
                          ...(prev.serviceCatalogSettings || {}),
                          minimumServiceDurationMinutes: Number(e.target.value || 30),
                        },
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="defaultRenewalReminderDays">Renewal Reminder Days</Label>
                    <Input
                      id="defaultRenewalReminderDays"
                      type="number"
                      min="1"
                      value={formData.serviceCatalogSettings?.defaultRenewalReminderDays ?? 7}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        serviceCatalogSettings: {
                          ...(prev.serviceCatalogSettings || {}),
                          defaultRenewalReminderDays: Number(e.target.value || 7),
                        },
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="autoRenewEnabled">Auto-renew subscriptions</Label>
                    <Switch
                      id="autoRenewEnabled"
                      checked={formData.subscriptionBillingSettings?.autoRenewEnabled ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          autoRenewEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="retryFailedPayments">Retry failed payments</Label>
                    <Switch
                      id="retryFailedPayments"
                      checked={formData.subscriptionBillingSettings?.retryFailedPayments ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          retryFailedPayments: checked,
                        },
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="maxRetryAttempts">Max Retry Attempts</Label>
                    <Input
                      id="maxRetryAttempts"
                      type="number"
                      min="0"
                      value={formData.subscriptionBillingSettings?.maxRetryAttempts ?? 3}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          maxRetryAttempts: Number(e.target.value || 0),
                        },
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="renewalGraceDays">Renewal Grace Days</Label>
                    <Input
                      id="renewalGraceDays"
                      type="number"
                      min="0"
                      value={formData.subscriptionBillingSettings?.renewalGraceDays ?? 7}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          renewalGraceDays: Number(e.target.value || 0),
                        },
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoiceLeadDays">Invoice Lead Days</Label>
                    <Input
                      id="invoiceLeadDays"
                      type="number"
                      min="0"
                      value={formData.subscriptionBillingSettings?.invoiceLeadDays ?? 3}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          invoiceLeadDays: Number(e.target.value || 0),
                        },
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredRenewalGateway">Preferred Renewal Gateway</Label>
                    <select
                      id="preferredRenewalGateway"
                      value={formData.subscriptionBillingSettings?.preferredRenewalGateway || 'whish'}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        subscriptionBillingSettings: {
                          ...(prev.subscriptionBillingSettings || {}),
                          preferredRenewalGateway: e.target.value as 'whish' | 'stripe' | 'paypal' | 'manual',
                        },
                      }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="whish">Whish</option>
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Payment Gateway Control Center</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewayWhishEnabled">Enable Whish</Label>
                    <Switch
                      id="gatewayWhishEnabled"
                      checked={formData.paymentGatewaySettings?.whishEnabled ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          whishEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewayStripeEnabled">Enable Stripe</Label>
                    <Switch
                      id="gatewayStripeEnabled"
                      checked={formData.paymentGatewaySettings?.stripeEnabled ?? true}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          stripeEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewaySquareEnabled">Enable Square</Label>
                    <Switch
                      id="gatewaySquareEnabled"
                      checked={formData.paymentGatewaySettings?.squareEnabled ?? false}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          squareEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewayPaypalEnabled">Enable PayPal</Label>
                    <Switch
                      id="gatewayPaypalEnabled"
                      checked={formData.paymentGatewaySettings?.paypalEnabled ?? false}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          paypalEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewayOmtEnabled">Enable OMT</Label>
                    <Switch
                      id="gatewayOmtEnabled"
                      checked={formData.paymentGatewaySettings?.omtEnabled ?? false}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          omtEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label htmlFor="gatewayBobEnabled">Enable BOB Finance</Label>
                    <Switch
                      id="gatewayBobEnabled"
                      checked={formData.paymentGatewaySettings?.bobEnabled ?? false}
                      onCheckedChange={(checked) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          bobEnabled: checked,
                        },
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="squareLocationId">Square Location ID</Label>
                    <Input
                      id="squareLocationId"
                      value={formData.paymentGatewaySettings?.squareLocationId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          squareLocationId: e.target.value,
                        },
                      }))}
                      placeholder="LXXXXXXXXXXXX"
                    />
                  </div>
                  <div>
                    <Label htmlFor="omtReceiverName">OMT Receiver Name</Label>
                    <Input
                      id="omtReceiverName"
                      value={formData.paymentGatewaySettings?.omtReceiverName || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          omtReceiverName: e.target.value,
                        },
                      }))}
                      placeholder="Store Owner"
                    />
                  </div>
                  <div>
                    <Label htmlFor="omtReceiverPhone">OMT Receiver Phone</Label>
                    <Input
                      id="omtReceiverPhone"
                      value={formData.paymentGatewaySettings?.omtReceiverPhone || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          omtReceiverPhone: e.target.value,
                        },
                      }))}
                      placeholder="+961..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="bobReceiverName">BOB Receiver Name</Label>
                    <Input
                      id="bobReceiverName"
                      value={formData.paymentGatewaySettings?.bobReceiverName || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          bobReceiverName: e.target.value,
                        },
                      }))}
                      placeholder="Store Owner"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bobReceiverPhone">BOB Receiver Phone</Label>
                    <Input
                      id="bobReceiverPhone"
                      value={formData.paymentGatewaySettings?.bobReceiverPhone || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          bobReceiverPhone: e.target.value,
                        },
                      }))}
                      placeholder="+961..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredCheckoutGateway">Preferred Checkout Gateway</Label>
                    <select
                      id="preferredCheckoutGateway"
                      value={formData.paymentGatewaySettings?.preferredGateway || 'whish'}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        paymentGatewaySettings: {
                          ...(prev.paymentGatewaySettings || {}),
                          preferredGateway: e.target.value as 'whish' | 'stripe' | 'square' | 'omt' | 'bob' | 'paypal' | 'manual',
                        },
                      }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="whish">Whish</option>
                      <option value="stripe">Stripe</option>
                      <option value="square">Square</option>
                      <option value="omt">OMT</option>
                      <option value="bob">BOB Finance</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          {/* Invoice Configuration */}
          <ProfileCollapsibleSection
            id="invoice"
            title="Invoice Settings"
            description="Customize invoice appearance and numbering"
            open={isProfileSectionOpen('invoice')}
            onOpenChange={(open) => setProfileSectionOpen('invoice', open)}
          >
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
                  <Input
                    id="invoicePrefix"
                    value={formData.invoiceNumberPrefix || 'INV'}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumberPrefix: e.target.value }))}
                    placeholder="INV"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: INV-001, INV-002
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="lastInvoiceNumber">Current Invoice Number</Label>
                  <Input
                    id="lastInvoiceNumber"
                    type="number"
                    value={(formData.lastInvoiceNumber || 0) === 0 ? '' : (formData.lastInvoiceNumber || 0)}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastInvoiceNumber: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) }))}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Next invoice: {(formData.invoiceNumberPrefix || 'INV')}-{String((formData.lastInvoiceNumber || 0) + 1).padStart(3, '0')}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="invoiceLogo">Company logo (invoices &amp; PDFs)</Label>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Company logo preview"
                      className="h-16 w-auto max-w-[200px] rounded border bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="h-16 w-28 rounded border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <Input
                    id="invoiceLogo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    className="max-w-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Shown on invoices, estimates, and receipts. PNG or JPG recommended. Save Changes after upload.
                </p>
              </div>

              <div>
                <Label htmlFor="invoiceTemplate">Invoice Template</Label>
                <select
                  id="invoiceTemplate"
                  value={formData.invoiceTemplate || 'modern'}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceTemplate: e.target.value as 'modern' | 'classic' | 'vibrant' }))}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="modern">Modern (Blue/Teal)</option>
                  <option value="classic">Classic (Black/Gold)</option>
                  <option value="vibrant">Vibrant (Orange/Purple)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose the design style for your invoices
                </p>
              </div>

              <div>
                <Label htmlFor="taxNumber">Tax Registration Number</Label>
                <Input
                  id="taxNumber"
                  value={formData.taxNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxNumber: e.target.value }))}
                  placeholder="Enter your tax/VAT registration number"
                />
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          {/* Product Settings */}
          <ProfileCollapsibleSection
            id="product-settings"
            title="Product Settings"
            description="Default price multiplier and product categories"
            open={isProfileSectionOpen('product-settings')}
            onOpenChange={(open) => setProfileSectionOpen('product-settings', open)}
          >
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label htmlFor="priceMultiplier">Default Price Multiplier</Label>
                <Input
                  id="priceMultiplier"
                  type="number"
                  min="1"
                  step="0.1"
                  value={(formData.priceMultiplier || 2.5) === 0 ? '' : (formData.priceMultiplier || 2.5)}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceMultiplier: e.target.value === '' ? 2.5 : (parseFloat(e.target.value) || 2.5) }))}
                  placeholder="2.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Suggested selling price = Total cost × {formData.priceMultiplier || 2.5}
                </p>
              </div>

              <div>
                <Label>Product Categories</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                    placeholder="Enter category name"
                  />
                  <Button type="button" onClick={handleAddCategory} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(formData.productCategories || []).map((category) => (
                    <div key={category}>
                      {editingCategory === category ? (
                        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md">
                          <Input
                            value={editCategoryValue}
                            onChange={(e) => setEditCategoryValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditCategory();
                              } else if (e.key === 'Escape') {
                                handleCancelEditCategory();
                              }
                            }}
                            className="h-6 w-32 text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditCategory}
                            className="hover:bg-green-500/20 rounded-full p-1"
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditCategory}
                            className="hover:bg-destructive/20 rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {category}
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(category)}
                            className="ml-1 hover:bg-blue-500/20 rounded-full p-0.5"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(category)}
                            className="hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These categories will be available when creating composed products
                </p>
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          {/* AI API Integration */}
          <ProfileCollapsibleSection
            id="ai-api"
            title="AI API Integration"
            description="Connect your external AI account and model credit pricing"
            open={isProfileSectionOpen('ai-api')}
            onOpenChange={(open) => setProfileSectionOpen('ai-api', open)}
          >
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <Label htmlFor="aiIntegrationEnabled">Enable AI API integration</Label>
                  <p className="text-xs text-muted-foreground">No in-app sidekick is created here. Requests are routed to your external AI API.</p>
                </div>
                <Switch
                  id="aiIntegrationEnabled"
                  checked={formData.aiIntegrationSettings?.enabled ?? false}
                  onCheckedChange={(checked) => setFormData((prev) => ({
                    ...prev,
                    aiIntegrationSettings: {
                      ...(prev.aiIntegrationSettings || {}),
                      enabled: checked,
                      assistantAccessMode: 'owner-account',
                    },
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aiApiBaseUrl">AI API Base URL</Label>
                  <Input
                    id="aiApiBaseUrl"
                    value={formData.aiIntegrationSettings?.apiBaseUrl || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      aiIntegrationSettings: {
                        ...(prev.aiIntegrationSettings || {}),
                        apiBaseUrl: e.target.value,
                        assistantAccessMode: 'owner-account',
                      },
                    }))}
                    placeholder="https://your-ai-gateway.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="aiApiKey">AI API Key</Label>
                  <Input
                    id="aiApiKey"
                    type="password"
                    value={formData.aiIntegrationSettings?.apiKey || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      aiIntegrationSettings: {
                        ...(prev.aiIntegrationSettings || {}),
                        apiKey: e.target.value,
                        assistantAccessMode: 'owner-account',
                      },
                    }))}
                    placeholder="sk_live_..."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleLoadAiCatalog} disabled={isLoadingAiCatalog}>
                  {isLoadingAiCatalog ? 'Loading models...' : 'Load AI Model Catalog'}
                </Button>
                {aiCatalogUpdatedAt && (
                  <p className="text-xs text-muted-foreground">Catalog updated: {new Date(aiCatalogUpdatedAt).toLocaleString()}</p>
                )}
              </div>

              {(formData.aiIntegrationSettings?.modelPricing || []).length > 0 && (
                <div className="rounded-md border p-4 space-y-3">
                  <p className="text-sm font-medium">Model Selection and Credit Pricing (USD)</p>
                  <div className="space-y-3">
                    {(formData.aiIntegrationSettings?.modelPricing || []).map((model) => (
                      <div key={model.modelId} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-md p-3">
                        <div className="md:col-span-4">
                          <Label className="text-xs">Model</Label>
                          <div className="text-sm font-medium">{model.label}</div>
                          <p className="text-xs text-muted-foreground">{model.provider} • {model.creditsPerUnit} credits / {model.unitLabel}</p>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Active</Label>
                          <div className="pt-2">
                            <Switch
                              checked={model.active}
                              onCheckedChange={(checked) => setFormData((prev) => ({
                                ...prev,
                                aiIntegrationSettings: {
                                  ...(prev.aiIntegrationSettings || {}),
                                  assistantAccessMode: 'owner-account',
                                  modelPricing: (prev.aiIntegrationSettings?.modelPricing || []).map((item) =>
                                    item.modelId === model.modelId ? { ...item, active: checked } : item,
                                  ),
                                },
                              }))}
                            />
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <Label htmlFor={`cost-${model.modelId}`} className="text-xs">Cost per credit (USD)</Label>
                          <Input
                            id={`cost-${model.modelId}`}
                            type="number"
                            min="0"
                            step="0.001"
                            value={model.costPerCreditUsd}
                            onChange={(e) => {
                              const value = Number(e.target.value || 0);
                              setFormData((prev) => ({
                                ...prev,
                                aiIntegrationSettings: {
                                  ...(prev.aiIntegrationSettings || {}),
                                  assistantAccessMode: 'owner-account',
                                  modelPricing: (prev.aiIntegrationSettings?.modelPricing || []).map((item) =>
                                    item.modelId === model.modelId ? { ...item, costPerCreditUsd: value } : item,
                                  ),
                                },
                              }));
                            }}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-xs">Cost per {model.unitLabel}</Label>
                          <Input value={`$${(model.creditsPerUnit * model.costPerCreditUsd).toFixed(3)}`} readOnly />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="defaultAiModelId">Default model for prepaid credit usage</Label>
                    <select
                      id="defaultAiModelId"
                      value={formData.aiIntegrationSettings?.defaultModelId || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        aiIntegrationSettings: {
                          ...(prev.aiIntegrationSettings || {}),
                          assistantAccessMode: 'owner-account',
                          defaultModelId: e.target.value,
                        },
                      }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Select default model</option>
                      {(formData.aiIntegrationSettings?.modelPricing || [])
                        .filter((model) => model.active)
                        .map((model) => (
                          <option key={model.modelId} value={model.modelId}>
                            {model.label} ({model.provider})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveAiSettings} disabled={isSavingAiSettings}>
                  {isSavingAiSettings ? 'Saving AI settings...' : 'Save AI Integration'}
                </Button>
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          {/* Custom Domain */}
          <ProfileCollapsibleSection
            id="custom-domain"
            title={<span className="flex items-center gap-2"><Globe className="h-5 w-5" />Custom Domain</span>}
            description="Point your own domain to your Grabio store"
            open={isProfileSectionOpen('custom-domain')}
            onOpenChange={(open) => setProfileSectionOpen('custom-domain', open)}
          >
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label htmlFor="customDomain">Domain Name</Label>
                <Input
                  id="customDomain"
                  name="customDomain"
                  autoComplete="off"
                  placeholder="shop.yourbrand.com"
                  value={formData.customDomain || ''}
                  onChange={e => {
                    autoProvisionAttemptRef.current = 0;
                    setDomainStatusDetails(null);
                    setFormData(prev => ({ ...prev, customDomain: e.target.value.trim().toLowerCase() }));
                  }}
                />
                <p className="text-xs text-muted-foreground">Enter without https:// (e.g. <code>shop.yourbrand.com</code>)</p>
              </div>

              <div className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <Label htmlFor="sslAutoProvisioningEnabled">SSL Auto-Provisioning</Label>
                  <p className="text-xs text-muted-foreground">Automatically checks domain/SSL status and retries provisioning while pending.</p>
                </div>
                <Switch
                  id="sslAutoProvisioningEnabled"
                  checked={formData.sslAutoProvisioningEnabled ?? true}
                  onCheckedChange={(checked) => {
                    autoProvisionAttemptRef.current = 0;
                    setFormData(prev => ({ ...prev, sslAutoProvisioningEnabled: checked }));
                  }}
                />
              </div>

              {formData.customDomain && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-medium">DNS Setup Instructions</p>
                  <p className="text-sm text-muted-foreground">
                    Add the following record to your domain's DNS settings:
                  </p>
                  <div className="font-mono text-xs bg-background border rounded p-3 space-y-1">
                    <div className="grid grid-cols-3 gap-2 text-muted-foreground font-sans text-xs uppercase mb-1">
                      <span>Type</span><span>Name</span><span>Value</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>CNAME</span>
                      <span>{formData.customDomain.includes('.') && formData.customDomain.split('.').length > 2 ? formData.customDomain.split('.')[0] : '@'}</span>
                      <span>market-flow-7b074.web.app</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">DNS changes may take up to 24 hours to propagate.</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                {formData.customDomainStatus === 'active' && <Badge className="bg-green-100 text-green-800">Active</Badge>}
                {formData.customDomainStatus === 'pending' && <Badge variant="secondary">Pending Verification</Badge>}
                {formData.customDomainStatus === 'error' && <Badge variant="destructive">Error</Badge>}
                {formData.sslAutoProvisioningEnabled && formData.customDomainStatus !== 'active' && (
                  <Badge className="bg-blue-100 text-blue-800">Auto-Provisioning On</Badge>
                )}
                {formData.customDomain && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isCheckingDomainStatus}
                    onClick={() => void handleCheckDomainStatus(false)}
                  >
                    {isCheckingDomainStatus ? 'Checking...' : 'Check Status'}
                  </Button>
                )}
                {formData.customDomain && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRegisteringDomain}
                    onClick={() => void handleRegisterDomain(false)}
                  >
                    {isRegisteringDomain ? 'Submitting...' : 'Register Domain'}
                  </Button>
                )}
              </div>

              {formData.customDomain && (
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">DNS Configuration Wizard</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className={getStatusBadgeClass(domainStatusDetails?.domainStatus || (formData.customDomainStatus === 'active' ? 'active' : 'pending'))}>
                      Domain: {domainStatusDetails?.domainStatus || (formData.customDomainStatus === 'active' ? 'active' : 'pending')}
                    </Badge>
                    <Badge className={getStatusBadgeClass(domainStatusDetails?.sslStatus || (formData.customDomainStatus === 'active' ? 'active' : 'pending'))}>
                      SSL: {domainStatusDetails?.sslStatus || (formData.customDomainStatus === 'active' ? 'active' : 'pending')}
                    </Badge>
                  </div>

                  <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
                    <li>Add the DNS record(s) below in your DNS provider panel.</li>
                    <li>Wait for DNS propagation (usually minutes, up to 24 hours).</li>
                    <li>Click <span className="font-medium text-foreground">Check Status</span> to verify domain and SSL activation.</li>
                  </ol>

                  {((domainStatusDetails?.domainStatus || formData.customDomainStatus || 'pending') === 'error' ||
                    (domainStatusDetails?.sslStatus || 'pending') === 'error') && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      Verification error detected. Re-check DNS records, click <span className="font-medium">Register Domain</span> to retry provisioning,
                      then click <span className="font-medium">Check Status</span> again.
                    </div>
                  )}

                  <div className="font-mono text-xs bg-background border rounded p-3 space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-muted-foreground font-sans text-xs uppercase mb-1">
                      <span>Type</span><span>Name</span><span>Value</span><span>Status</span>
                    </div>
                    {(domainStatusDetails?.dnsRecords?.length ? domainStatusDetails.dnsRecords : getFallbackDnsRecords(formData.customDomain || '')).map((record, idx) => (
                      <div className="grid grid-cols-4 gap-2" key={`${record.type}-${record.name}-${idx}`}>
                        <span>{record.type}</span>
                        <span>{record.name}</span>
                        <span className="truncate" title={record.value}>{record.value}</span>
                        <span className={record.status === 'verified' ? 'text-green-700' : 'text-amber-700'}>{record.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </ProfileCollapsibleSection>

          {/* Admin MFA */}
          <ProfileCollapsibleSection
            id="mfa"
            title="Admin MFA (TOTP)"
            description="Authenticator app two-factor authentication for admin access"
            open={isProfileSectionOpen('mfa')}
            onOpenChange={(open) => setProfileSectionOpen('mfa', open)}
          >
            <CardContent className="space-y-4 pt-0">
              {user?.role !== 'admin' ? (
                <p className="text-sm text-muted-foreground">MFA enrollment is available to admin accounts only.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    {enrolledMfaFactors.length > 0 ? (
                      <Badge className="bg-green-100 text-green-800">Enabled ({enrolledMfaFactors.length})</Badge>
                    ) : (
                      <Badge variant="secondary">Not Enabled</Badge>
                    )}
                    {enrolledMfaFactors.length > 0 ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isDisablingMfa}
                        onClick={disableTotpMfa}
                      >
                        {isDisablingMfa ? 'Disabling...' : 'Disable MFA'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPreparingMfa || !!totpSecret}
                        onClick={prepareTotpEnrollment}
                      >
                        {isPreparingMfa ? 'Preparing...' : 'Set Up Authenticator'}
                      </Button>
                    )}
                  </div>

                  {totpSecret && totpUri && enrolledMfaFactors.length === 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium">Finish Authenticator Enrollment</p>
                      <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
                        <li>Scan this QR code in your authenticator app.</li>
                        <li>Enter the 6-digit code generated by the app.</li>
                        <li>Click Verify & Enable MFA.</li>
                      </ol>

                      <div className="flex justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                          alt="Authenticator QR"
                          className="h-44 w-44 rounded border bg-white p-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="totp-code">Authenticator Code</Label>
                        <Input
                          id="totp-code"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="123456"
                          value={totpCode}
                          maxLength={6}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isEnrollingMfa}
                          onClick={enrollTotpMfa}
                        >
                          {isEnrollingMfa ? 'Enabling...' : 'Verify & Enable MFA'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTotpSecret(null);
                            setTotpUri('');
                            setTotpCode('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Admin IP Allowlist</p>
                        <p className="text-xs text-muted-foreground">
                          Restrict admin routes to specific public IP addresses.
                        </p>
                      </div>
                      <Switch
                        checked={!!formData.adminIpWhitelistEnabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, adminIpWhitelistEnabled: checked }))}
                      />
                    </div>

                    {formData.adminIpWhitelistEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="admin-ip-allowlist">Allowed Public IPs (one per line)</Label>
                        <Textarea
                          id="admin-ip-allowlist"
                          value={(formData.adminIpAllowlist || []).join('\n')}
                          onChange={(e) => {
                            const entries = e.target.value
                              .split('\n')
                              .map((line) => line.trim())
                              .filter((line) => line.length > 0);
                            setFormData(prev => ({ ...prev, adminIpAllowlist: entries }));
                          }}
                          placeholder={`203.0.113.10\n198.51.100.27`}
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          Keep at least one valid public IP to avoid locking yourself out. Localhost is always allowed during development.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </ProfileCollapsibleSection>

          {/* GDPR Tools */}
          <ProfileCollapsibleSection
            id="gdpr"
            title="GDPR Tools"
            description="Data export, deletion requests, and privacy policy generator"
            open={isProfileSectionOpen('gdpr')}
            onOpenChange={(open) => setProfileSectionOpen('gdpr', open)}
          >
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Data Export</p>
                <p className="text-xs text-muted-foreground">
                  Generate and download a JSON export containing your store profile, products, orders, and customer data.
                </p>
                <Button type="button" variant="outline" size="sm" disabled={isExportingGdpr} onClick={handleGdprExport}>
                  {isExportingGdpr ? 'Exporting...' : 'Export My Data'}
                </Button>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-medium text-red-800">Right-to-be-Forgotten Request</p>
                <p className="text-xs text-red-700">
                  This submits a deletion request for your account/store data. Type DELETE to confirm.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="gdpr-delete-confirm">Type DELETE to confirm</Label>
                  <Input
                    id="gdpr-delete-confirm"
                    value={gdprDeleteConfirm}
                    onChange={(e) => setGdprDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isRequestingGdprDelete}
                  onClick={handleGdprDeleteRequest}
                >
                  {isRequestingGdprDelete ? 'Submitting...' : 'Request Deletion'}
                </Button>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Privacy Policy Generator</p>
                <p className="text-xs text-muted-foreground">
                  Generate a starter privacy policy from your store profile details and download it for review.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={generatePrivacyPolicyText}>
                    Generate Policy
                  </Button>
                  <Button type="button" size="sm" onClick={downloadPrivacyPolicy}>
                    Download Policy
                  </Button>
                </div>
                <Textarea
                  value={generatedPrivacyPolicy}
                  onChange={(e) => setGeneratedPrivacyPolicy(e.target.value)}
                  rows={10}
                  placeholder="Generated privacy policy will appear here..."
                />
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          {/* Marketplace + Dropshipping Integrations */}
          <ProfileCollapsibleSection
            id="marketplace"
            title="Marketplace & Dropshipping Integrations"
            description="Amazon, eBay, Alibaba channels and dropshipping partners"
            open={isProfileSectionOpen('marketplace')}
            onOpenChange={(open) => setProfileSectionOpen('marketplace', open)}
          >
            <CardContent className="space-y-6 pt-0">
              <div>
                <h4 className="font-medium mb-3">Marketplaces</h4>
                <div className="space-y-3">
                  {(formData.marketplaceIntegrations || []).map((integration) => (
                    <div key={integration.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{integration.name}</div>
                        <Button
                          type="button"
                          variant={integration.enabled ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateMarketplaceIntegration(integration.id, 'enabled', !integration.enabled)}
                        >
                          {integration.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                      {integration.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label>Merchant ID</Label>
                            <Input
                              value={integration.merchantId || ''}
                              onChange={(e) => updateMarketplaceIntegration(integration.id, 'merchantId', e.target.value)}
                              placeholder="Merchant account ID"
                            />
                          </div>
                          <div>
                            <Label>API Key</Label>
                            <Input
                              value={integration.apiKey || ''}
                              onChange={(e) => updateMarketplaceIntegration(integration.id, 'apiKey', e.target.value)}
                              placeholder="API key"
                            />
                          </div>
                          <div>
                            <Label>API Secret</Label>
                            <Input
                              type="password"
                              value={integration.apiSecret || ''}
                              onChange={(e) => updateMarketplaceIntegration(integration.id, 'apiSecret', e.target.value)}
                              placeholder="API secret"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Dropshipping Partners</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addDropshippingPartner}>
                    <Plus className="h-4 w-4 mr-1" /> Add Partner
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.dropshippingPartners || []).map((partner) => (
                    <div key={partner.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={partner.name}
                          onChange={(e) => updateDropshippingPartner(partner.id, 'name', e.target.value)}
                          placeholder="Partner name"
                          className="max-w-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={partner.enabled ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateDropshippingPartner(partner.id, 'enabled', !partner.enabled)}
                          >
                            {partner.enabled ? 'Enabled' : 'Disabled'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDropshippingPartner(partner.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Contact Email</Label>
                          <Input
                            type="email"
                            value={partner.contactEmail || ''}
                            onChange={(e) => updateDropshippingPartner(partner.id, 'contactEmail', e.target.value)}
                            placeholder="partner@email.com"
                          />
                        </div>
                        <div>
                          <Label>Webhook URL</Label>
                          <Input
                            value={partner.webhookUrl || ''}
                            onChange={(e) => updateDropshippingPartner(partner.id, 'webhookUrl', e.target.value)}
                            placeholder="https://partner.example/webhook"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={partner.notes || ''}
                          onChange={(e) => updateDropshippingPartner(partner.id, 'notes', e.target.value)}
                          placeholder="SLA, minimum order qty, handling notes..."
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </ProfileCollapsibleSection>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open(`/store/${formData.slug}`, '_blank', 'noopener,noreferrer')}
              disabled={!formData.slug}
            >
              Visit Store Profile
            </Button>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
    </AdminPageShell>
  );
};

export default AdminProfile;