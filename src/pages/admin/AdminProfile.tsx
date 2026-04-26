import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
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
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { StoreProfile, StorePage, MarketplaceIntegrationSetting, DropshippingPartnerSetting } from '../../types/storeProfile';
import { generateSlug, checkSlugAvailability, isValidSlug, generateUniqueSlug } from '@/lib/slugify';
import { getSubscriptionTierName, hasComposedAccess } from '@/lib/subscriptionHelper';

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
    paypalEnabled: false,
    bankTransferEnabled: false,
    cashOnDeliveryEnabled: true,
    preferredGateway: 'whish',
  },
  seoSettings: {
    metaTitleSuffix: '',
    metaDescription: '',
    keywords: [],
    canonicalBaseUrl: '',
    robotsIndex: true,
    robotsFollow: true,
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
  },
  serviceCatalogSettings: {
    allowServiceProducts: true,
    allowRecurringSubscriptions: true,
    defaultServiceBillingType: 'one-time',
    minimumServiceDurationMinutes: 30,
    defaultRenewalReminderDays: 7,
  },
  subscriptionBillingSettings: {
    autoRenewEnabled: true,
    retryFailedPayments: true,
    maxRetryAttempts: 3,
    renewalGraceDays: 7,
    invoiceLeadDays: 3,
    preferredRenewalGateway: 'whish',
  }
};

const AdminProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const db = getFirestore();
  const [formData, setFormData] = useState<StoreProfile>(defaultProfile);
  const [isSaving, setIsSaving] = useState(false);

  // Load store profile from Firestore on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        const actualStoreId = getActualStoreId(user);
        if (!actualStoreId) return;
        try {
          const db = getFirestore();
          const profileRef = doc(db, 'storeProfiles', actualStoreId);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data() as StoreProfile;
            setFormData({
              ...defaultProfile,
              ...data,
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
            });
            setLogoPreview(data.logo || '');
          } else {
            setFormData(defaultProfile);
            setLogoPreview('');
          }
        } catch (err) {
          setFormData(defaultProfile);
          setLogoPreview('');
        }
      }
    };
    fetchProfile();
  // defaultProfile is a stable top-level constant; include only user id in deps.
  }, [user?.id]);

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
  const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setFormData({ ...formData, logo: result });
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
        // Auto-generate slug if not provided
        if (!formData.slug && formData.name) {
          const autoSlug = await generateUniqueSlug(formData.name, 'storeProfiles', user.id);
          formData.slug = autoSlug;
        }
        
        // Sanitize formData: replace undefined with null
        const cleanFormData = Object.fromEntries(
          Object.entries(formData).map(([k, v]) => [k, v === undefined ? null : v])
        );
        // Add required Store fields for marketplace visibility
        cleanFormData.id = user.id;
        cleanFormData.storeId = user.id;
        cleanFormData.ownerId = user.id;
  if (cleanFormData.isPremium === undefined) cleanFormData.isPremium = false;
        if (!cleanFormData.template) cleanFormData.template = 'modern';
  // credits feature removed: do not include allowsCredits
        const profileRef = doc(db, 'storeProfiles', user.id);
        await setDoc(profileRef, cleanFormData);
        // Persist storeId in sellers collection and localStorage
        const sellerRef = doc(db, 'sellers', user.id);
        await setDoc(sellerRef, { storeId: user.id }, { merge: true });
        // Update localStorage
        const savedSellerInfo = localStorage.getItem('sellerInfo');
  const sellerInfo = savedSellerInfo ? JSON.parse(savedSellerInfo) : {};
  sellerInfo.storeId = user.id;
  localStorage.setItem('sellerInfo', JSON.stringify(sellerInfo));
        // Update user context with storeId
        if (setUser) setUser((prev) => prev ? { ...prev, storeId: user.id } : prev);
        toast({
          title: "Success",
          description: "Store profile updated successfully! (Saved to Firebase)"
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to update store profile.",
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
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Store Profile" />}
      <div className="p-4 md:p-6">
        <BackButton />
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            Store Profile
          </h1>
          <p className="text-muted-foreground">Manage your store information and branding</p>
        </div>

        {/* Subscription Card */}
        <Card className="max-w-2xl mb-6 border-2 border-primary">
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
        </Card>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* Logo Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Store Logo</CardTitle>
              <CardDescription>
                Upload your store logo. This will be displayed on your store page and in search results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={logoPreview} alt="Store logo" />
                        <AvatarFallback className="text-2xl">
                          {(formData.name && formData.name.charAt(0)) || <Camera className="h-8 w-8" />}
                        </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-center space-y-2">
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center space-x-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>Upload Logo</span>
                    </div>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or JPEG (max 5MB)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Essential details about your store
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
                <Label htmlFor="slogan">Store Slogan</Label>
                <Input
                  id="slogan"
                  value={formData.slogan}
                  onChange={(e) => setFormData(prev => ({ ...prev, slogan: e.target.value }))}
                  placeholder="A catchy tagline for your store"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Store Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell customers what makes your store special"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="aboutUs">About Us (Optional)</Label>
                <Textarea
                  id="aboutUs"
                  value={formData.aboutUs || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, aboutUs: e.target.value }))}
                  placeholder="Share your store story and what you stand for"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mission">Mission (Optional)</Label>
                  <Textarea
                    id="mission"
                    value={formData.mission || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mission: e.target.value }))}
                    placeholder="What is your mission?"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="vision">Vision (Optional)</Label>
                  <Textarea
                    id="vision"
                    value={formData.vision || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, vision: e.target.value }))}
                    placeholder="What is your long-term vision?"
                    rows={3}
                  />
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
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                How customers can reach you
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
          </Card>

          {/* Social Media Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media</CardTitle>
              <CardDescription>
                Connect your social media accounts (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="facebook">Facebook URL</Label>
                <Input
                  id="facebook"
                  type="url"
                  autoComplete="off"
                  value={formData.facebook}
                  onChange={(e) => setFormData(prev => ({ ...prev, facebook: e.target.value }))}
                  placeholder="https://facebook.com/yourstore"
                />
              </div>
              
              <div>
                <Label htmlFor="instagram">Instagram URL</Label>
                <Input
                  id="instagram"
                  type="url"
                  autoComplete="off"
                  value={formData.instagram}
                  onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="https://instagram.com/yourstore"
                />
              </div>
              
              <div>
                <Label htmlFor="twitter">Twitter URL</Label>
                <Input
                  id="twitter"
                  type="url"
                  autoComplete="off"
                  value={formData.twitter}
                  onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="https://twitter.com/yourstore"
                />
              </div>

              <div>
                <Label htmlFor="whatsappBusiness" className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  WhatsApp Business Number
                </Label>
                <Input
                  id="whatsappBusiness"
                  name="whatsappBusiness"
                  type="tel"
                  autoComplete="off"
                  value={formData.whatsappBusiness || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappBusiness: e.target.value.replace(/[^0-9+]/g, '') }))}
                  placeholder="+9611234567 (international format)"
                />
                <p className="text-xs text-muted-foreground mt-1">Customers can order directly via WhatsApp from the product page.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Growth, SEO & Subscription Controls</CardTitle>
              <CardDescription>
                Configure discoverability, Meta/Facebook data, service policy, and recurring billing defaults.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>

          {/* Invoice Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
              <CardDescription>
                Customize your invoice appearance and numbering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
          </Card>

          {/* Product Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Product Settings</CardTitle>
              <CardDescription>
                Configure settings for composed products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
          </Card>

          {/* Banner / Carousel Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5" />Banner Images</CardTitle>
              <CardDescription>Upload header/banner images for your store carousel (background image + carousel)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="carousel-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors w-fit">
                  <Upload className="h-4 w-4" />
                  <span>Add Images</span>
                </div>
                <Input id="carousel-upload" type="file" accept="image/*" multiple onChange={handleAddCarouselImages} className="hidden" />
              </Label>
              {(formData.carouselImages || []).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(formData.carouselImages || []).map((url, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border h-28">
                      <img src={url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveCarouselImage(idx)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No banner images uploaded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Custom Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GripVertical className="h-5 w-5" />Store Pages</CardTitle>
              <CardDescription>Create custom pages for your store. "About Us" (page 2) and "Products" (page 3) are built-in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(formData.customPages || []).map((page, idx) => (
                <div key={page.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => handleMovePage(idx, 'up')} disabled={idx === 0} className="hover:bg-accent rounded p-0.5 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                      <button type="button" onClick={() => handleMovePage(idx, 'down')} disabled={idx === (formData.customPages || []).length - 1} className="hover:bg-accent rounded p-0.5 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                    </div>
                    <Input
                      id={`page-name-${page.id}`}
                      name={`page-name-${page.id}`}
                      autoComplete="off"
                      aria-label="Page name"
                      value={page.name}
                      onChange={e => handlePageNameChange(page.id, e.target.value)}
                      placeholder="Page name"
                      className="flex-1"
                    />
                    <button type="button" onClick={() => handleRemovePage(page.id)} className="hover:bg-destructive/20 rounded p-1">
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground mb-1 block">Page Image</span>
                      {page.image ? (
                        <div className="relative group rounded-lg overflow-hidden border h-28">
                          <img src={page.image} alt={page.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePageImage(page.id)}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Label htmlFor={`page-img-${page.id}`} className="cursor-pointer">
                          <div className="flex items-center gap-2 border-2 border-dashed rounded-lg h-28 justify-center hover:bg-muted/50 transition-colors text-muted-foreground text-sm">
                            <ImagePlus className="h-5 w-5" />Upload Image
                          </div>
                          <Input id={`page-img-${page.id}`} type="file" accept="image/*" onChange={e => handlePageImageChange(page.id, e)} className="hidden" />
                        </Label>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`page-content-${page.id}`} className="text-xs text-muted-foreground mb-1 block">Page Content</Label>
                      <Textarea
                        id={`page-content-${page.id}`}
                        name={`page-content-${page.id}`}
                        autoComplete="off"
                        value={page.content || ''}
                        onChange={e => handlePageContentChange(page.id, e.target.value)}
                        placeholder="Write the content for this page..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  id="new-page-name"
                  name="new-page-name"
                  autoComplete="off"
                  aria-label="New page name"
                  value={newPageName}
                  onChange={e => setNewPageName(e.target.value)}
                  placeholder="New page name (e.g. Gallery, Contact)"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPage())}
                />
                <Button type="button" variant="outline" onClick={handleAddPage} disabled={!newPageName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />Add Page
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Template Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Template Colors</CardTitle>
              <CardDescription>Customize the colors of your store page template</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { key: 'primary', label: 'Primary Color', defaultVal: '#0ea5e9' },
                  { key: 'secondary', label: 'Secondary Color', defaultVal: '#6366f1' },
                  { key: 'accent', label: 'Accent Color', defaultVal: '#f97316' },
                ] as const).map(({ key, label, defaultVal }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`color-${key}`}>{label}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id={`color-${key}`}
                        name={`color-${key}`}
                        type="color"
                        autoComplete="off"
                        value={formData.templateColors?.[key] || defaultVal}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          templateColors: {
                            primary: prev.templateColors?.primary || '#0ea5e9',
                            secondary: prev.templateColors?.secondary || '#6366f1',
                            accent: prev.templateColors?.accent || '#f97316',
                            [key]: e.target.value,
                          },
                        }))}
                        className="h-10 w-10 rounded cursor-pointer border"
                      />
                      <Label htmlFor={`color-hex-${key}`} className="sr-only">{label} hex value</Label>
                      <Input
                        id={`color-hex-${key}`}
                        name={`color-hex-${key}`}
                        autoComplete="off"
                        value={formData.templateColors?.[key] || defaultVal}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          templateColors: {
                            primary: prev.templateColors?.primary || '#0ea5e9',
                            secondary: prev.templateColors?.secondary || '#6366f1',
                            accent: prev.templateColors?.accent || '#f97316',
                            [key]: e.target.value,
                          },
                        }))}
                        placeholder={defaultVal}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Domain */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Custom Domain</CardTitle>
              <CardDescription>Point your own domain (e.g. shop.yourbrand.com) to your store.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customDomain">Domain Name</Label>
                <Input
                  id="customDomain"
                  name="customDomain"
                  autoComplete="off"
                  placeholder="shop.yourbrand.com"
                  value={formData.customDomain || ''}
                  onChange={e => setFormData(prev => ({ ...prev, customDomain: e.target.value.trim().toLowerCase() }))}
                />
                <p className="text-xs text-muted-foreground">Enter without https:// (e.g. <code>shop.yourbrand.com</code>)</p>
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
                {formData.customDomain && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRegisteringDomain}
                    onClick={async () => {
                      setIsRegisteringDomain(true);
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
                        toast({ title: 'Domain submitted', description: 'Status is pending — check back after DNS propagates.' });
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        toast({ title: 'Registration failed', description: msg, variant: 'destructive' });
                      } finally {
                        setIsRegisteringDomain(false);
                      }
                    }}
                  >
                    {isRegisteringDomain ? 'Submitting...' : 'Register Domain'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Marketplace + Dropshipping Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Marketplace & Dropshipping Integrations</CardTitle>
              <CardDescription>
                Enable marketplace channels (including Alibaba) and configure your dropshipping partners.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
          </Card>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProfile;