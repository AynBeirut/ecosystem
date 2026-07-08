import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  EDITOR_CHROME_DESCRIPTIONS,
  EDITOR_CHROME_LABELS,
  isEditorChromeId,
  type EditorLayoutDraft,
  type EditorSelectableId,
} from '@/lib/editorPreviewBridge';
import { SECTION_DESCRIPTIONS, SECTION_LABELS, toggleSectionEnabled, updateSection } from '@/lib/storeSectionDefaults';
import {
  uploadSectionBackgroundImage,
} from '@/lib/storeMediaUpload';
import type { RatingDisplayType, StoreSectionOrder } from '@/types/storeProfile';

type SectionSettingsPanelProps = {
  selectedId: EditorSelectableId | null;
  section: StoreSectionOrder | null;
  sections: StoreSectionOrder[];
  layoutDraft: EditorLayoutDraft;
  storeId?: string | null;
  storeBackgroundImage?: string;
  galleryImages?: string[];
  onChange: (sections: StoreSectionOrder[]) => void;
  onLayoutChange: (patch: Partial<EditorLayoutDraft>) => void;
  onHeroBannerUpload?: (file: File) => Promise<void>;
  onGalleryUpload?: (file: File) => Promise<void>;
  ratingDisplayType?: RatingDisplayType;
  onRatingDisplayChange?: (v: RatingDisplayType) => void;
};

function OptionPills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          data-allow-multi-click="true"
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            value === opt.id ? 'bg-[#303030] text-white' : 'bg-[#f6f6f7] text-[#616161] hover:bg-[#ededed] border border-[#e3e3e5]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const CONTAINER_OPTIONS = [
  { id: 'full-width' as const, label: 'Full width' },
  { id: 'wide' as const, label: 'Wide' },
  { id: 'contained' as const, label: 'Contained' },
];

const PADDING_OPTIONS = [
  { id: 'none' as const, label: 'None' },
  { id: 'small' as const, label: 'Small' },
  { id: 'medium' as const, label: 'Medium' },
  { id: 'large' as const, label: 'Large' },
];

const ANIMATION_OPTIONS = [
  { id: 'none' as const, label: 'None' },
  { id: 'fade' as const, label: 'Fade' },
  { id: 'slide-up' as const, label: 'Slide up' },
  { id: 'zoom' as const, label: 'Zoom' },
];

const STORE_CARD_OPTIONS = [
  { id: 'standard' as const, label: 'Standard' },
  { id: 'split' as const, label: 'Split' },
  { id: 'minimal' as const, label: 'Minimal' },
  { id: 'full-width' as const, label: 'Full width' },
];

const RATING_DISPLAY_OPTIONS: { id: RatingDisplayType; label: string }[] = [
  { id: 'stars', label: 'Stars' },
  { id: 'pill', label: 'Pill' },
  { id: 'number', label: 'Number' },
  { id: 'card', label: 'Card' },
  { id: 'minimal', label: 'Minimal' },
];

const MENU_STYLE_OPTIONS = [
  { id: 'classic' as const, label: 'Classic' },
  { id: 'centered' as const, label: 'Centered' },
  { id: 'bold' as const, label: 'Bold' },
  { id: 'sticky-glass' as const, label: 'Sticky glass' },
  { id: 'hamburger' as const, label: 'Hamburger' },
];

const SectionSettingsPanel: React.FC<SectionSettingsPanelProps> = ({
  selectedId,
  section,
  sections,
  layoutDraft,
  storeId,
  storeBackgroundImage,
  galleryImages = [],
  onChange,
  onLayoutChange,
  onHeroBannerUpload,
  onGalleryUpload,
  ratingDisplayType = 'stars',
  onRatingDisplayChange,
}) => {
  const [uploading, setUploading] = useState<'section' | 'hero' | 'gallery' | null>(null);
  const sectionFileRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const runUpload = async (kind: 'section' | 'hero' | 'gallery', file: File) => {
    if (!storeId || !section) return;
    setUploading(kind);
    try {
      if (kind === 'section') {
        const url = await uploadSectionBackgroundImage(storeId, section.id, file);
        onChange(updateSection(sections, section.id, { backgroundImage: url }));
        toast.success('Section background uploaded');
      } else if (kind === 'hero') {
        if (!onHeroBannerUpload) throw new Error('Upload not available');
        await onHeroBannerUpload(file);
        toast.success('Hero banner updated');
      } else if (kind === 'gallery') {
        if (!onGalleryUpload) throw new Error('Upload not available');
        await onGalleryUpload(file);
        toast.success('Gallery image added');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-sm text-[#616161] bg-white border-l border-[#e3e3e5]">
        Select a section in the preview or sidebar
      </div>
    );
  }

  if (isEditorChromeId(selectedId)) {
    return (
      <div className="h-full overflow-y-auto bg-white border-l border-[#e3e3e5]">
        <div className="px-4 py-3 border-b border-[#e3e3e5]">
          <p className="font-semibold text-sm text-[#303030]">{EDITOR_CHROME_LABELS[selectedId]}</p>
          <p className="text-xs text-[#616161] mt-0.5">{EDITOR_CHROME_DESCRIPTIONS[selectedId]}</p>
        </div>
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-[#303030]">Visible</Label>
            <Switch
              checked={
                selectedId === 'store_header'
                  ? layoutDraft.showStoreHeader
                  : layoutDraft.showNavigation
              }
              onCheckedChange={(on) =>
                onLayoutChange(
                  selectedId === 'store_header'
                    ? { showStoreHeader: on }
                    : { showNavigation: on },
                )
              }
            />
          </div>

          {selectedId === 'store_header' && (
            <div className="space-y-2">
              <Label className="text-xs text-[#616161]">Store card layout</Label>
              <OptionPills
                value={layoutDraft.storeCardStyle}
                options={STORE_CARD_OPTIONS}
                onChange={(v) => onLayoutChange({ storeCardStyle: v })}
              />
            </div>
          )}

          {selectedId === 'navigation' && (
            <div className="space-y-2">
              <Label className="text-xs text-[#616161]">Menu style</Label>
              <OptionPills
                value={layoutDraft.menuStyle}
                options={MENU_STYLE_OPTIONS}
                onChange={(v) => onLayoutChange({ menuStyle: v })}
              />
            </div>
          )}

          <p className="text-[10px] text-[#616161] pt-2 border-t border-[#e3e3e5]">
            Logo &amp; store copy: use the <strong>Content</strong> tab in the left panel.
          </p>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-sm text-[#616161] bg-white border-l border-[#e3e3e5]">
        Select a section in the preview or sidebar
      </div>
    );
  }

  const patch = (p: Partial<StoreSectionOrder>) =>
    onChange(updateSection(sections, section.id, p));

  return (
    <div className="h-full overflow-y-auto bg-white border-l border-[#e3e3e5]">
      <div className="px-4 py-3 border-b border-[#e3e3e5]">
        <p className="font-semibold text-sm text-[#303030]">{SECTION_LABELS[section.id]}</p>
        <p className="text-xs text-[#616161] mt-0.5">{SECTION_DESCRIPTIONS[section.id]}</p>
      </div>
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm text-[#303030]">Visible</Label>
          <Switch
            checked={section.enabled}
            onCheckedChange={(on) => onChange(toggleSectionEnabled(sections, section.id, on))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#616161]">Grid width</Label>
          <div className="flex rounded-md border border-[#e3e3e5] overflow-hidden">
            {(['full', 'half', 'third'] as const).map((w) => (
              <button
                key={w}
                type="button"
                data-allow-multi-click="true"
                onClick={() => patch({ width: w })}
                className={`flex-1 py-1.5 text-xs font-medium ${
                  (section.width || 'full') === w ? 'bg-[#303030] text-white' : 'bg-white hover:bg-[#f6f6f7]'
                }`}
              >
                {w === 'full' ? 'Full' : w === 'half' ? '½' : '⅓'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#616161]">Container</Label>
          <OptionPills
            value={section.container ?? 'contained'}
            options={CONTAINER_OPTIONS}
            onChange={(v) => patch({ container: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#616161]">Padding</Label>
          <OptionPills
            value={section.padding ?? 'medium'}
            options={PADDING_OPTIONS}
            onChange={(v) => patch({ padding: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#616161]">Animation</Label>
          <OptionPills
            value={section.animation ?? 'fade'}
            options={ANIMATION_OPTIONS}
            onChange={(v) => patch({ animation: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm text-[#303030]">Borders &amp; corners</Label>
          <Switch
            checked={section.showBorders ?? true}
            onCheckedChange={(on) => patch({ showBorders: on })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm text-[#303030]">Section background fill</Label>
          <Switch
            checked={section.showBackground ?? true}
            onCheckedChange={(on) => patch({ showBackground: on })}
          />
        </div>

        {section.id === 'reviews' && onRatingDisplayChange && (
          <div className="space-y-2 pt-2 border-t border-[#e3e3e5]">
            <Label className="text-xs text-[#616161]">Rating display (header)</Label>
            <OptionPills
              value={ratingDisplayType}
              options={RATING_DISPLAY_OPTIONS}
              onChange={onRatingDisplayChange}
            />
            <p className="text-[10px] text-[#616161]">
              How average rating appears in the store header.
            </p>
          </div>
        )}

        {/* ── Images ── */}
        <div className="space-y-3 pt-2 border-t border-[#e3e3e5]">
          <Label className="text-xs font-semibold text-[#303030]">Images</Label>

          {section.id === 'hero' && (
            <div className="space-y-2 rounded-lg border border-[#e3e3e5] bg-[#f6f6f7] p-3">
              <p className="text-[11px] font-medium text-[#303030]">Hero banner (main photo)</p>
              <p className="text-[10px] text-[#616161]">Large banner at the top of your storefront</p>
              {storeBackgroundImage ? (
                <img
                  src={storeBackgroundImage}
                  alt="Hero banner"
                  className="h-20 w-full rounded-md object-cover border"
                />
              ) : null}
              <input
                ref={heroFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void runUpload('hero', file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!storeId || uploading === 'hero'}
                onClick={() => heroFileRef.current?.click()}
              >
                {uploading === 'hero' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5 mr-1" />
                )}
                {storeBackgroundImage ? 'Replace banner' : 'Upload banner'}
              </Button>
            </div>
          )}

          {section.id === 'gallery' && (
            <div className="space-y-2 rounded-lg border border-[#e3e3e5] bg-[#f6f6f7] p-3">
              <p className="text-[11px] font-medium text-[#303030]">Gallery photos</p>
              {galleryImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {galleryImages.slice(0, 6).map((url) => (
                    <img key={url} src={url} alt="" className="h-12 w-full rounded object-cover border" />
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[#616161]">No gallery images yet</p>
              )}
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void runUpload('gallery', file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!storeId || uploading === 'gallery'}
                onClick={() => galleryFileRef.current?.click()}
              >
                {uploading === 'gallery' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5 mr-1" />
                )}
                Add gallery photo
              </Button>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-[#e3e3e5] p-3">
            <p className="text-[11px] font-medium text-[#303030]">Section background image</p>
            <p className="text-[10px] text-[#616161]">Optional image behind this section&apos;s content</p>
            {section.backgroundImage ? (
              <div className="relative">
                <img
                  src={section.backgroundImage}
                  alt="Section background"
                  className="h-20 w-full rounded-md object-cover border"
                />
                <button
                  type="button"
                  data-allow-multi-click="true"
                  className="absolute top-1 right-1 rounded bg-white/90 p-1 shadow"
                  onClick={() => patch({ backgroundImage: '' })}
                  title="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </button>
              </div>
            ) : null}
            <input
              ref={sectionFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void runUpload('section', file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              disabled={!storeId || uploading === 'section'}
              onClick={() => sectionFileRef.current?.click()}
            >
              {uploading === 'section' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5 mr-1" />
              )}
              {section.backgroundImage ? 'Replace image' : 'Upload image'}
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-[#616161] pt-2 border-t border-[#e3e3e5]">
          Carousel &amp; advanced media:{' '}
          <a href="/admin/templates" className="text-[#005bd3] underline">
            Classic Templates → Media
          </a>
        </p>
      </div>
    </div>
  );
};

export default SectionSettingsPanel;
