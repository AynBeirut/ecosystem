import React, { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Eye, Check, Upload, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';

import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { assertCanUploadBytes, trackStorageUsageAfterUpload } from '@/lib/subscriptionEnforcement';

type TemplateId = 'modern' | 'minimal' | 'classic' | 'vibrant' | 'professional' | 'artistic';

type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  colors: string[];
  features: string[];
  isPremium: boolean;
};

const AdminTemplates: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const db = getFirestore();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateId>('modern');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploadingSection, setUploadingSection] = useState<'background' | 'carousel' | 'gallery' | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ mode: 'carousel' | 'gallery'; index: number } | null>(null);

  const templates: TemplateDefinition[] = [
    {
      id: 'modern',
      name: 'Modern',
      description: 'Clean, contemporary design with bold typography and spacious layouts',
      colors: ['#38B2AC', '#2C5282', '#ED8936'],
      features: ['Responsive Design', 'Dark Mode', 'Animation Effects'],
      isPremium: false
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Simple, elegant design focusing on content and whitespace',
      colors: ['#718096', '#2D3748', '#E2E8F0'],
      features: ['Clean Layout', 'Typography Focus', 'Fast Loading'],
      isPremium: false
    },
    {
      id: 'classic',
      name: 'Classic',
      description: 'Traditional design with proven usability and timeless appeal',
      colors: ['#2C5282', '#3182CE', '#63B3ED'],
      features: ['Traditional Layout', 'High Contrast', 'Easy Navigation'],
      isPremium: false
    },
    {
      id: 'vibrant',
      name: 'Vibrant',
      description: 'Energetic design with bold colors and dynamic elements',
      colors: ['#ED8936', '#F56565', '#9F7AEA'],
      features: ['Bold Colors', 'Dynamic Layout', 'Interactive Elements'],
      isPremium: true
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Corporate-style design perfect for business and B2B stores',
      colors: ['#2D3748', '#4A5568', '#718096'],
      features: ['Corporate Style', 'Trust Elements', 'Formal Layout'],
      isPremium: true
    },
    {
      id: 'artistic',
      name: 'Artistic',
      description: 'Creative design with unique layouts and artistic elements',
      colors: ['#9F7AEA', '#ED64A6', '#F6AD55'],
      features: ['Creative Layout', 'Artistic Elements', 'Unique Design'],
      isPremium: true
    }
  ];

  // Load selected template from Firestore on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      if (storeId) {
        const profileRef = doc(db, 'storeProfiles', storeId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          if (data.template && templates.some((t) => t.id === data.template)) {
            setSelectedTemplate(data.template as TemplateId);
            setPreviewTemplate(data.template as TemplateId);
          }
          setBackgroundImage(typeof data.storeBackgroundImage === 'string' ? data.storeBackgroundImage : '');
          setCarouselImages(Array.isArray(data.carouselImages) ? data.carouselImages.filter((url: unknown) => typeof url === 'string') : []);
          setGalleryImages(Array.isArray(data.galleryImages) ? data.galleryImages.filter((url: unknown) => typeof url === 'string') : []);
        }
      }
    };
    fetchTemplate();
    // eslint-disable-next-line
  }, [storeId]);

  const previewStyles: Record<TemplateId, { shell: string; header: string; block: string; title: string }> = {
    modern: { shell: 'bg-gradient-to-b from-cyan-50 to-indigo-50', header: 'bg-white/90 border-cyan-200', block: 'bg-white border-cyan-100', title: 'text-cyan-800' },
    minimal: { shell: 'bg-white', header: 'bg-white border-gray-200', block: 'bg-white border-gray-200', title: 'text-gray-800' },
    classic: { shell: 'bg-blue-50/50', header: 'bg-white border-blue-300', block: 'bg-white border-blue-200', title: 'text-blue-900' },
    vibrant: { shell: 'bg-gradient-to-br from-orange-50 via-pink-50 to-violet-100', header: 'bg-white border-orange-200', block: 'bg-white border-pink-200', title: 'text-fuchsia-900' },
    professional: { shell: 'bg-slate-100', header: 'bg-white border-slate-300', block: 'bg-white border-slate-200', title: 'text-slate-900' },
    artistic: { shell: 'bg-gradient-to-tr from-violet-100 to-amber-50', header: 'bg-white border-violet-200', block: 'bg-white border-rose-200', title: 'text-violet-900' },
  };

  const handleSelectTemplate = async (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    if (storeId) {
      const profileRef = doc(db, 'storeProfiles', storeId);
      await setDoc(profileRef, { template: templateId }, { merge: true });
    }
    toast({
      title: "Template Applied",
      description: `Your store is now using the ${templates.find(t => t.id === templateId)?.name} template.`
    });
  };

  const handlePreview = (templateId: TemplateId) => {
    setPreviewTemplate(templateId);
  };

  const saveMediaSettings = async (next: { backgroundImage?: string; carouselImages?: string[]; galleryImages?: string[] }) => {
    if (!storeId) return;
    const profileRef = doc(db, 'storeProfiles', storeId);
    await setDoc(profileRef, {
      ...(next.backgroundImage !== undefined ? { storeBackgroundImage: next.backgroundImage } : {}),
      ...(next.carouselImages !== undefined ? { carouselImages: next.carouselImages } : {}),
      ...(next.galleryImages !== undefined ? { galleryImages: next.galleryImages } : {}),
    }, { merge: true });
  };

  const uploadSingleImage = async (file: File, folder: 'background' | 'carousel' | 'gallery') => {
    if (storeId) {
      await assertCanUploadBytes(db, storeId, file.size);
    }
    const safeFileName = encodeURIComponent(file.name);
    const path = `store-media/${storeId || 'unknown'}/${folder}/${Date.now()}_${safeFileName}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, file);
    if (storeId) {
      await trackStorageUsageAfterUpload(db, storeId, file.size);
    }
    return getDownloadURL(imageRef);
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !storeId) return;

    setUploadingSection('background');
    try {
      const url = await uploadSingleImage(file, 'background');
      setBackgroundImage(url);
      await saveMediaSettings({ backgroundImage: url });
      toast({ title: 'Background Updated', description: 'Store background image uploaded successfully.' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: 'Could not upload background image.', variant: 'destructive' });
      console.error('Background upload failed', error);
    } finally {
      setUploadingSection(null);
    }
  };

  const handleMultiUpload = async (event: React.ChangeEvent<HTMLInputElement>, mode: 'carousel' | 'gallery') => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || !storeId) return;

    setUploadingSection(mode);
    try {
      const uploadedUrls = await Promise.all(files.map((file) => uploadSingleImage(file, mode)));

      if (mode === 'carousel') {
        const next = [...carouselImages, ...uploadedUrls].slice(0, 12);
        setCarouselImages(next);
        await saveMediaSettings({ carouselImages: next });
      } else {
        const next = [...galleryImages, ...uploadedUrls].slice(0, 24);
        setGalleryImages(next);
        await saveMediaSettings({ galleryImages: next });
      }

      toast({ title: 'Images Uploaded', description: `${uploadedUrls.length} image(s) uploaded to ${mode}.` });
    } catch (error) {
      toast({ title: 'Upload Failed', description: `Could not upload ${mode} images.`, variant: 'destructive' });
      console.error(`${mode} upload failed`, error);
    } finally {
      setUploadingSection(null);
    }
  };

  const removeImageAt = async (mode: 'carousel' | 'gallery', index: number) => {
    const source = mode === 'carousel' ? carouselImages : galleryImages;
    const next = source.filter((_, i) => i !== index);

    if (mode === 'carousel') {
      setCarouselImages(next);
      await saveMediaSettings({ carouselImages: next });
    } else {
      setGalleryImages(next);
      await saveMediaSettings({ galleryImages: next });
    }
  };

  const reorderImages = async (mode: 'carousel' | 'gallery', sourceIndex: number, targetIndex: number) => {
    const source = mode === 'carousel' ? carouselImages : galleryImages;
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= source.length || targetIndex >= source.length) {
      return;
    }

    const next = [...source];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);

    if (mode === 'carousel') {
      setCarouselImages(next);
      await saveMediaSettings({ carouselImages: next });
    } else {
      setGalleryImages(next);
      await saveMediaSettings({ galleryImages: next });
    }
  };

  const handleDragStart = (mode: 'carousel' | 'gallery', index: number) => {
    setDraggingItem({ mode, index });
  };

  const handleDrop = async (mode: 'carousel' | 'gallery', targetIndex: number) => {
    if (!draggingItem || draggingItem.mode !== mode) {
      setDraggingItem(null);
      return;
    }
    await reorderImages(mode, draggingItem.index, targetIndex);
    setDraggingItem(null);
  };

  const moveImageByStep = async (mode: 'carousel' | 'gallery', index: number, step: -1 | 1) => {
    await reorderImages(mode, index, index + step);
  };

  return (
    <div className="min-h-screen bg-background">
  {isMobile && <MobileHeader title="Store Templates" />}
      
      <div className="p-4 md:p-6">
        <BackButton to="/admin/profile" label="Back to Store Profile" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Store Templates
          </h1>
          <p className="text-muted-foreground">Choose a template that best represents your brand and style</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              This is how your storefront theme style will look for the selected preview template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg border p-4 ${previewStyles[previewTemplate].shell}`}>
              <div className={`rounded-md border p-3 mb-3 ${previewStyles[previewTemplate].header}`}>
                <div className={`font-semibold ${previewStyles[previewTemplate].title}`}>Store Header</div>
                <div className="text-sm text-muted-foreground">Brand, slogan, and contact details area</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                  <div className="text-sm font-medium">Product Card</div>
                  <div className="text-xs text-muted-foreground">Image • Name • Price</div>
                </div>
                <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                  <div className="text-sm font-medium">Announcement</div>
                  <div className="text-xs text-muted-foreground">Important store update block</div>
                </div>
                <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                  <div className="text-sm font-medium">Review Card</div>
                  <div className="text-xs text-muted-foreground">Rating and customer feedback</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className={`relative overflow-hidden ${selectedTemplate === template.id ? 'ring-2 ring-primary' : ''}`}>
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              )}
              
              {template.isPremium && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="secondary">Premium</Badge>
                </div>
              )}

              <div className={`aspect-video relative overflow-hidden p-3 ${previewStyles[template.id].shell}`}>
                <div className={`rounded-md border p-2 mb-2 ${previewStyles[template.id].header}`}>
                  <div className={`text-xs font-semibold ${previewStyles[template.id].title}`}>{template.name} Header</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-md border p-2 ${previewStyles[template.id].block}`}>
                    <div className="text-[10px] font-medium">Products</div>
                  </div>
                  <div className={`rounded-md border p-2 ${previewStyles[template.id].block}`}>
                    <div className="text-[10px] font-medium">Reviews</div>
                  </div>
                </div>
              </div>

              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {template.name}
                </CardTitle>
                <CardDescription>
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Color Palette</div>
                    <div className="flex gap-2">
                      {template.colors.map((color, index) => (
                        <span
                          key={index}
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm template-color"
                          data-color={color}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Features</div>
                    <div className="flex flex-wrap gap-1">
                      {template.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={selectedTemplate === template.id ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => handleSelectTemplate(template.id)}
                      disabled={selectedTemplate === template.id}
                    >
                      {selectedTemplate === template.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Active
                        </>
                      ) : (
                        'Use Template'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(template.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Template Customization */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Template Customization</CardTitle>
            <CardDescription>
              Shopify-style storefront media controls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Store Background Image</h4>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                    <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      {uploadingSection === 'background' ? 'Uploading...' : 'Upload'}
                    </span>
                  </label>
                </div>
                {backgroundImage ? (
                  <div className="relative">
                    <img src={backgroundImage} alt="Store background" className="w-full h-48 object-cover rounded-lg border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={async () => {
                        setBackgroundImage('');
                        await saveMediaSettings({ backgroundImage: '' });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                    No background image uploaded
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Homepage Carousel Images</h4>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMultiUpload(e, 'carousel')} />
                    <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      {uploadingSection === 'carousel' ? 'Uploading...' : 'Add Images'}
                    </span>
                  </label>
                </div>
                {carouselImages.length === 0 ? (
                  <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                    No carousel images yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {carouselImages.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className={`relative ${draggingItem?.mode === 'carousel' && draggingItem.index === index ? 'opacity-60 ring-2 ring-primary rounded-md' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart('carousel', index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => void handleDrop('carousel', index)}
                        onDragEnd={() => setDraggingItem(null)}
                      >
                        <img src={url} alt={`Carousel ${index + 1}`} className="w-full h-24 rounded-md object-cover border" />
                        <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </div>
                        {isMobile && (
                          <div className="absolute top-1 left-1 flex gap-1">
                            <button
                              type="button"
                              onClick={() => void moveImageByStep('carousel', index, -1)}
                              disabled={index === 0}
                              className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"
                              aria-label="Move image earlier"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveImageByStep('carousel', index, 1)}
                              disabled={index === carouselImages.length - 1}
                              className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"
                              aria-label="Move image later"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImageAt('carousel', index)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Store Gallery Images</h4>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMultiUpload(e, 'gallery')} />
                    <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      {uploadingSection === 'gallery' ? 'Uploading...' : 'Add Images'}
                    </span>
                  </label>
                </div>
                {galleryImages.length === 0 ? (
                  <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                    No gallery images yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {galleryImages.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className={`relative ${draggingItem?.mode === 'gallery' && draggingItem.index === index ? 'opacity-60 ring-2 ring-primary rounded-md' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart('gallery', index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => void handleDrop('gallery', index)}
                        onDragEnd={() => setDraggingItem(null)}
                      >
                        <img src={url} alt={`Gallery ${index + 1}`} className="w-full h-24 rounded-md object-cover border" />
                        <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </div>
                        {isMobile && (
                          <div className="absolute top-1 left-1 flex gap-1">
                            <button
                              type="button"
                              onClick={() => void moveImageByStep('gallery', index, -1)}
                              disabled={index === 0}
                              className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"
                              aria-label="Move image earlier"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveImageByStep('gallery', index, 1)}
                              disabled={index === galleryImages.length - 1}
                              className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"
                              aria-label="Move image later"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImageAt('gallery', index)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminTemplates;