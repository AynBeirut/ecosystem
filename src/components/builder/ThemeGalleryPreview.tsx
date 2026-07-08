import React from 'react';
import type { StoreThemeId } from '@/lib/storeThemeCatalog';
import { THEME_GALLERY_META, type ThemeGalleryLayout } from '@/lib/themeGalleryMeta';

type ThemeGalleryPreviewProps = {
  themeId: StoreThemeId;
  className?: string;
};

function ProductThumb({ src, tall }: { src: string; tall?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-md bg-gray-100 ${tall ? 'row-span-2' : ''}`}
      style={{ minHeight: tall ? undefined : '100%' }}
    >
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

function LayoutBody({
  layout,
  meta,
}: {
  layout: ThemeGalleryLayout;
  meta: (typeof THEME_GALLERY_META)[StoreThemeId];
}) {
  const imgs = meta.productImages;

  switch (layout) {
    case 'minimal-list':
      return (
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          {imgs.slice(0, 3).map((src, i) => (
            <div key={i} className={`flex h-5 gap-1 overflow-hidden rounded ${meta.block}`}>
              <img src={src} alt="" className="h-full w-8 shrink-0 object-cover" loading="lazy" />
              <div className="flex-1 bg-gray-50" />
            </div>
          ))}
        </div>
      );
    case 'split-grid':
      return (
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          <div className="grid h-10 grid-cols-2 gap-1">
            <img src={meta.previewHeroImage} alt="" className="rounded object-cover" loading="lazy" />
            <div className={`rounded bg-gradient-to-br ${meta.header} opacity-90`} />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1">
            {imgs.slice(0, 3).map((src, i) => (
              <ProductThumb key={i} src={src} />
            ))}
          </div>
        </div>
      );
    case 'centered-large':
      return (
        <div className="grid flex-1 grid-cols-2 gap-1.5 p-1.5">
          {imgs.slice(0, 2).map((src, i) => (
            <ProductThumb key={i} src={src} tall />
          ))}
        </div>
      );
    case 'masonry':
      return (
        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1 p-1.5">
          <ProductThumb src={imgs[0]} tall />
          <ProductThumb src={imgs[1]} />
          <ProductThumb src={imgs[2]} tall />
          <ProductThumb src={imgs[3]} />
        </div>
      );
    case 'fullwidth-masonry':
      return (
        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1 p-1.5">
          <ProductThumb src={imgs[0]} tall />
          <ProductThumb src={imgs[1]} />
          <ProductThumb src={imgs[2]} tall />
          <ProductThumb src={imgs[3]} />
        </div>
      );
    case 'spotlight':
      return (
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          <div className={`flex h-12 items-end overflow-hidden rounded-lg ${meta.block} p-1`}>
            <img src={imgs[0]} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />
            <div className="ml-1 flex-1 space-y-0.5 pb-0.5">
              <div className="h-1 w-3/4 rounded bg-gray-200" />
              <div className="h-1 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-4 gap-1">
            {imgs.map((src, i) => (
              <ProductThumb key={i} src={src} />
            ))}
          </div>
        </div>
      );
    case 'fullscreen-grid':
    default:
      return (
        <div className="grid flex-1 grid-cols-4 gap-1 p-1.5">
          {imgs.map((src, i) => (
            <ProductThumb key={i} src={src} />
          ))}
        </div>
      );
  }
}

/** Shopify-style mini storefront mockup with real photos */
const ThemeGalleryPreview: React.FC<ThemeGalleryPreviewProps> = ({ themeId, className = '' }) => {
  const meta = THEME_GALLERY_META[themeId];
  const heroH =
    meta.layout === 'minimal-list'
      ? 'h-[22%]'
      : meta.layout === 'centered-large' || meta.layout === 'split-grid'
        ? 'h-[28%]'
        : meta.layout === 'fullwidth-masonry' || meta.layout === 'masonry'
          ? 'h-[24%]'
          : 'h-[32%]';

  return (
    <div
      className={`relative overflow-hidden rounded-t-lg border-b border-black/5 ${meta.shell} ${className}`}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1 border-b border-black/5 bg-white/80 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        <div className="mx-auto h-1.5 w-16 rounded-full bg-gray-200" />
      </div>

      <div className="flex aspect-[16/10] flex-col">
        {/* Nav strip */}
        <div className="flex h-4 shrink-0 items-center gap-1 border-b border-black/5 bg-white/90 px-2">
          <div className="h-2 w-2 rounded-full bg-gray-300" />
          <div className="h-1 flex-1 max-w-[40%] rounded bg-gray-200" />
          <div className="ml-auto flex gap-0.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1 w-3 rounded bg-gray-200" />
            ))}
          </div>
        </div>

        {/* Hero with real image */}
        <div className={`relative shrink-0 overflow-hidden ${heroH}`}>
          <img
            src={meta.previewHeroImage}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${meta.header} opacity-55 mix-blend-multiply`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {meta.layout !== 'split-grid' && (
            <div className="absolute bottom-1.5 left-2 right-2">
              <div className="h-1 w-1/2 rounded bg-white/90" />
              <div className="mt-0.5 h-0.5 w-1/3 rounded bg-white/60" />
            </div>
          )}
        </div>

        <LayoutBody layout={meta.layout} meta={meta} />
      </div>
    </div>
  );
};

export default ThemeGalleryPreview;
