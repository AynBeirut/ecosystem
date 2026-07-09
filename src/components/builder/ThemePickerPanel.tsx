import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STORE_THEME_CATALOG, type StoreThemeId } from '@/lib/storeThemeCatalog';
import { THEME_GALLERY_META } from '@/lib/themeGalleryMeta';
import ThemeGalleryPreview from '@/components/builder/ThemeGalleryPreview';

type ThemePickerPanelProps = {
  activeThemeId?: string;
  onSelect: (themeId: StoreThemeId) => void;
  applying?: boolean;
};

const ThemePickerPanel: React.FC<ThemePickerPanelProps> = ({
  activeThemeId,
  onSelect,
  applying = false,
}) => (
  <div className="flex h-full flex-col bg-[#f6f6f7]">
    <div className="border-b border-[#e3e3e5] bg-white px-3 py-2.5">
      <p className="text-xs font-semibold text-[#303030]">Discover themes</p>
      <p className="mt-0.5 text-[10px] text-[#616161]">
        Each theme changes layout, structure, and colors — not just the palette.
      </p>
    </div>
    <div className="flex-1 space-y-3 overflow-y-auto p-2">
      {STORE_THEME_CATALOG.map((theme) => {
        const active = activeThemeId === theme.id;
        const meta = THEME_GALLERY_META[theme.id];
        return (
          <article
            key={theme.id}
            className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
              active ? 'border-[#005bd3] ring-2 ring-[#005bd3]/25' : 'border-[#e3e3e5] hover:border-[#005bd3]/30'
            }`}
          >
            <ThemeGalleryPreview themeId={theme.id} />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#303030]">{theme.name}</p>
                  <p className="text-[10px] text-[#616161]">{meta.industry}</p>
                </div>
                {active ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#303030] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-[11px] leading-snug text-[#616161]">{theme.description}</p>
              <div className="flex flex-wrap gap-1">
                {meta.features.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-[#f6f6f7] px-1.5 py-0.5 text-[9px] font-medium text-[#616161]"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex gap-1">
                  {theme.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={active ? 'secondary' : 'default'}
                  className={`h-7 text-xs shrink-0 ${active ? '' : 'bg-[#303030] hover:bg-[#1a1a1a] text-white'}`}
                  disabled={active || applying}
                  onClick={() => onSelect(theme.id)}
                >
                  {active ? 'Active' : 'Add'}
                </Button>
              </div>
              {theme.isPremium && (
                <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Premium
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  </div>
);

export default ThemePickerPanel;
