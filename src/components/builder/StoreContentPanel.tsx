import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, Plus, Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { mergeTemplateColors } from '@/lib/storeContentDraft';
import type { StorePage } from '@/types/storeProfile';

type StoreContentPanelProps = {
  draft: StoreContentDraft;
  onChange: (patch: Partial<StoreContentDraft>) => void;
};

const StoreContentPanel: React.FC<StoreContentPanelProps> = ({ draft, onChange }) => {
  const carouselRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [newPageName, setNewPageName] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const patch = (p: Partial<StoreContentDraft>) => onChange(p);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await readFileAsDataUrl(file);
      patch({ logo: url });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCarouselUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all(Array.from(files).map(readFileAsDataUrl));
    patch({ carouselImages: [...(draft.carouselImages || []), ...urls] });
  };

  const handleAddPage = () => {
    const name = newPageName.trim();
    if (!name) return;
    const pages = draft.customPages || [];
    const newPage: StorePage = {
      id: `page_${Date.now()}`,
      name,
      content: '',
      order: pages.length,
    };
    patch({ customPages: [...pages, newPage] });
    setNewPageName('');
  };

  const updatePage = (pageId: string, updates: Partial<StorePage>) => {
    patch({
      customPages: (draft.customPages || []).map((p) => (p.id === pageId ? { ...p, ...updates } : p)),
    });
  };

  const removePage = (pageId: string) => {
    patch({ customPages: (draft.customPages || []).filter((p) => p.id !== pageId) });
  };

  const defaultColors = { primary: '#0ea5e9', secondary: '#6366f1', accent: '#f97316' };
  const colors = mergeTemplateColors(defaultColors, draft.templateColors) ?? defaultColors;

  return (
    <div className="h-full overflow-y-auto bg-white text-[#303030]">
      <div className="px-4 py-3 border-b border-[#e3e3e5]">
        <p className="font-semibold text-sm">Store content</p>
        <p className="text-xs text-[#616161] mt-0.5">
          Text, images, and colors for your storefront — not invoices.
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Logo */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Logo</Label>
          <div className="flex items-center gap-3">
            {draft.logo ? (
              <img src={draft.logo} alt="Logo" className="h-14 w-14 rounded-full object-cover border" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[#f6f6f7] border flex items-center justify-center text-xs text-[#616161]">
                None
              </div>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleLogoUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={logoUploading}
              onClick={() => logoRef.current?.click()}
            >
              {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload logo
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-[#616161]">Logo position</Label>
            <div className="flex flex-wrap gap-1">
              {(['left', 'center', 'right'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  data-allow-multi-click="true"
                  onClick={() => patch({ logoPosition: pos })}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium capitalize ${
                    (draft.logoPosition || 'left') === pos
                      ? 'bg-[#303030] text-white'
                      : 'bg-[#f6f6f7] text-[#616161] hover:bg-[#ededed] border border-[#e3e3e5]'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="space-y-3 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold">Store copy</Label>
          <div className="space-y-2">
            <Label className="text-[10px] text-[#616161]">Slogan</Label>
            <Input
              value={draft.slogan || ''}
              onChange={(e) => patch({ slogan: e.target.value })}
              placeholder="A catchy tagline"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-[#616161]">Description</Label>
            <Textarea
              value={draft.description || ''}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What makes your store special"
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-[#616161]">About us</Label>
            <Textarea
              value={draft.aboutUs || ''}
              onChange={(e) => patch({ aboutUs: e.target.value })}
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[#616161]">Mission</Label>
              <Textarea
                value={draft.mission || ''}
                onChange={(e) => patch({ mission: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[#616161]">Vision</Label>
              <Textarea
                value={draft.vision || ''}
                onChange={(e) => patch({ vision: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Social */}
        <div className="space-y-2 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold">Social links</Label>
          {([
            { key: 'facebook' as const, label: 'Facebook', placeholder: 'https://facebook.com/...' },
            { key: 'instagram' as const, label: 'Instagram', placeholder: 'https://instagram.com/...' },
            { key: 'twitter' as const, label: 'Twitter / X', placeholder: 'https://x.com/...' },
            { key: 'whatsappBusiness' as const, label: 'WhatsApp', placeholder: '+961...' },
          ]).map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-[#616161]">{label}</Label>
              <Input
                value={draft[key] || ''}
                onChange={(e) => patch({ [key]: e.target.value })}
                placeholder={placeholder}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>

        {/* Carousel */}
        <div className="space-y-2 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold">Banner carousel</Label>
          <input
            ref={carouselRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleCarouselUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs w-full"
            onClick={() => carouselRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5 mr-1" />
            Add banner images
          </Button>
          {(draft.carouselImages || []).length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {(draft.carouselImages || []).map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} alt="" className="h-12 w-full rounded object-cover border" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      patch({ carouselImages: (draft.carouselImages || []).filter((_, i) => i !== idx) })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#616161]">No carousel images yet</p>
          )}
        </div>

        {/* Template colors */}
        <div className="space-y-2 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold">Brand colors</Label>
          {([
            { key: 'primary' as const, label: 'Primary' },
            { key: 'secondary' as const, label: 'Secondary' },
            { key: 'accent' as const, label: 'Accent' },
          ]).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) =>
                  patch({ templateColors: mergeTemplateColors(colors, { [key]: e.target.value }) })
                }
                className="h-8 w-8 rounded cursor-pointer border"
              />
              <span className="text-[11px] text-[#616161]">{label}</span>
              <Input
                value={colors[key]}
                onChange={(e) =>
                  patch({ templateColors: mergeTemplateColors(colors, { [key]: e.target.value }) })
                }
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
          ))}
        </div>

        {/* Custom pages */}
        <div className="space-y-2 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold">Custom pages</Label>
          {(draft.customPages || []).map((page) => (
            <div key={page.id} className="rounded-lg border border-[#e3e3e5] p-2 space-y-2">
              <div className="flex gap-1">
                <Input
                  value={page.name}
                  onChange={(e) => updatePage(page.id, { name: e.target.value })}
                  className="h-7 text-xs flex-1"
                />
                <button type="button" onClick={() => removePage(page.id)} className="p-1 text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                value={page.content || ''}
                onChange={(e) => updatePage(page.id, { content: e.target.value })}
                rows={2}
                placeholder="Page content"
                className="text-xs resize-none"
              />
            </div>
          ))}
          <div className="flex gap-1">
            <Input
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              placeholder="New page name"
              className="h-8 text-xs flex-1"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPage())}
            />
            <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={handleAddPage}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-[#616161] pt-2 border-t border-[#e3e3e5]">
          Advanced layout options:{' '}
          <Link to="/admin/templates" className="text-[#005bd3] underline">
            Classic Templates
          </Link>
        </p>
      </div>
    </div>
  );
};

export default StoreContentPanel;
