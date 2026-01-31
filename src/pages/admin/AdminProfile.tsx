import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Upload, Store, Camera, Plus, X, Check, AlertCircle, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { StoreProfile } from '../../types/storeProfile';
import { generateSlug, checkSlugAvailability, isValidSlug, generateUniqueSlug } from '@/lib/slugify';

const defaultProfile: StoreProfile = {
  name: '',
  description: '',
  location: '',
  website: '',
  slogan: '',
  phone: '',
  email: '',
  facebook: '',
  instagram: '',
  twitter: '',
  logo: '',
  status: 'online',
  productCategories: ['Food', 'Beverages', 'Desserts', 'Bakery', 'Manufactured Goods', 'Electronics', 'Clothing', 'Services', 'Package', 'Box', 'Bag', 'Other'],
  priceMultiplier: 2.5
};

const AdminProfile: React.FC = () => {
  const { user, setUser } = useAuth();
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
            setFormData(data);
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
                      https://grabio.space/store/{formData.slug || 'your-store-name'}
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
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
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
                  value={formData.twitter}
                  onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="https://twitter.com/yourstore"
                />
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