import type { StoreSectionId, StoreSectionOrder } from '@/types/storeProfile';

export const SECTION_LABELS: Record<StoreSectionId, string> = {
  hero: 'Hero / Banner',
  about: 'About Us',
  announcements: 'Announcements',
  products: 'Featured products',
  gallery: 'Image gallery',
  reviews: 'Customer reviews',
  contact: 'Contact form',
};

export const SECTION_DESCRIPTIONS: Record<StoreSectionId, string> = {
  hero: 'Main banner with headline and call to action',
  about: 'Your story, mission, and brand trust',
  announcements: 'News, promos, and store updates',
  products: 'Product grid from your catalog',
  gallery: 'Photo grid or portfolio',
  reviews: 'Ratings and testimonials',
  contact: 'Contact form and details',
};

export function defaultStoreSectionOrder(): StoreSectionOrder[] {
  return [
    { id: 'hero', enabled: true, order: 0, width: 'full', container: 'full-width', padding: 'none', showBackground: true, showBorders: false, animation: 'fade', customCss: '' },
    { id: 'about', enabled: true, order: 1, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'announcements', enabled: true, order: 2, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'products', enabled: true, order: 3, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'gallery', enabled: true, order: 4, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'reviews', enabled: true, order: 5, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'contact', enabled: true, order: 6, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
  ];
}

export function mergeSectionOrderFromProfile(existing?: StoreSectionOrder[]): StoreSectionOrder[] {
  const defaults = defaultStoreSectionOrder();
  if (!existing?.length) return defaults;

  const byId = new Map(existing.map((s) => [s.id, s]));
  return defaults.map((def, index) => {
    const saved = byId.get(def.id);
    if (!saved) return { ...def, order: index };
    return { ...def, ...saved, order: saved.order ?? index };
  }).sort((a, b) => a.order - b.order).map((s, index) => ({ ...s, order: index }));
}

export function reorderSections(
  sections: StoreSectionOrder[],
  draggedId: StoreSectionId,
  targetId: StoreSectionId,
): StoreSectionOrder[] {
  if (draggedId === targetId) return sections;
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((s) => s.id === draggedId);
  const to = sorted.findIndex((s) => s.id === targetId);
  if (from < 0 || to < 0) return sections;
  const [moved] = sorted.splice(from, 1);
  sorted.splice(to, 0, moved);
  return sorted.map((s, index) => ({ ...s, order: index }));
}

export function toggleSectionEnabled(
  sections: StoreSectionOrder[],
  id: StoreSectionId,
  enabled: boolean,
): StoreSectionOrder[] {
  return sections.map((s) => (s.id === id ? { ...s, enabled } : s));
}

export function updateSection(
  sections: StoreSectionOrder[],
  id: StoreSectionId,
  patch: Partial<StoreSectionOrder>,
): StoreSectionOrder[] {
  return sections.map((s) => (s.id === id ? { ...s, ...patch } : s));
}
