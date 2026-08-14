import type {
  AboutLayout,
  ContactFormStyle,
  HeroLayout,
  MenuStyle,
  PageLayout,
  ProductCardAnimation,
  ProductDisplayType,
  RatingDisplayType,
  StoreCardStyle,
  StoreSectionId,
  StoreSectionOrder,
  VisualStyle,
} from '@/types/storeProfile';
import type { StoreContentDraft } from '@/lib/storeContentDraft';

/** Fixed chrome regions above the section list (not persisted in sectionOrder). */
export type EditorChromeId = 'store_header' | 'navigation';

export type EditorSelectableId = StoreSectionId | EditorChromeId;

export type EditorLayoutDraft = {
  menuStyle: MenuStyle;
  storeCardStyle: StoreCardStyle;
  showStoreHeader: boolean;
  showNavigation: boolean;
};

export const EDITOR_CHROME_LABELS: Record<EditorChromeId, string> = {
  store_header: 'Store header',
  navigation: 'Navigation menu',
};

export const EDITOR_CHROME_DESCRIPTIONS: Record<EditorChromeId, string> = {
  store_header: 'Logo, store name, ratings, and contact strip',
  navigation: 'Home / Products / About page tabs',
};

export const EDITOR_CHROME_ORDER: EditorChromeId[] = ['store_header', 'navigation'];

export function isEditorChromeId(id: string): id is EditorChromeId {
  return id === 'store_header' || id === 'navigation';
}

export function defaultEditorLayoutDraft(
  profile?: Partial<{ menuStyle?: MenuStyle; storeCardStyle?: StoreCardStyle }>,
): EditorLayoutDraft {
  return {
    menuStyle: profile?.menuStyle ?? 'classic',
    storeCardStyle: profile?.storeCardStyle ?? 'standard',
    showStoreHeader: true,
    showNavigation: true,
  };
}

/** Live theme/layout overrides pushed to the preview iframe (avoids full iframe reload). */
export type EditorThemeDraft = {
  template?: string;
  heroLayout?: HeroLayout;
  productDisplayType?: ProductDisplayType;
  productCardAnimation?: ProductCardAnimation;
  aboutLayout?: AboutLayout;
  contactFormStyle?: ContactFormStyle;
  ratingDisplayType?: RatingDisplayType;
  pageLayout?: PageLayout;
  visualStyle?: VisualStyle;
};

export type EditorPreviewStatePayload = {
  sectionOrder: StoreSectionOrder[];
  layout: EditorLayoutDraft;
  content?: StoreContentDraft;
  theme?: EditorThemeDraft;
};

export const EDITOR_PREVIEW_READY = 'grabio:preview-ready';
export const EDITOR_PREVIEW_STATE = 'grabio:editor-state';

/** Isolated preview entry — never mounts the full admin AuthProvider tree. */
export const EDITOR_EMBED_PREVIEW_BASE = '/embed/store-preview';

export function isEditorEmbedFrame(): boolean {
  if (typeof window === 'undefined') return false;
  if (isEditorEmbedPreviewPath(window.location.pathname)) return true;
  // Parent iframe sets name="grabio-theme-preview" — fallback for legacy preview URLs.
  if (window.name === 'grabio-theme-preview') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('editorEmbed') === '1') return true;
  if (params.get('editorPreview') !== '1') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** True for theme-editor iframe preview (query param or embed frame). */
export function isEditorPreviewActive(searchParams: URLSearchParams): boolean {
  return searchParams.get('editorPreview') === '1' || isEditorEmbedFrame();
}

export function buildEditorPreviewSrc(storeId: string, slug?: string | null, previewVersion = 0): string {
  const slugValue = String(slug || '').trim();
  const path = slugValue
    ? `${EDITOR_EMBED_PREVIEW_BASE}/store/${encodeURIComponent(slugValue)}`
    : `${EDITOR_EMBED_PREVIEW_BASE}/store/id/${encodeURIComponent(storeId)}`;
  return `${path}?editorPreview=1&v=${previewVersion}`;
}

export function isEditorEmbedPreviewPath(pathname: string): boolean {
  return pathname === EDITOR_EMBED_PREVIEW_BASE || pathname.startsWith(`${EDITOR_EMBED_PREVIEW_BASE}/`);
}

export function postEditorPreviewState(
  target: Window | null | undefined,
  payload: EditorPreviewStatePayload,
  revision?: number,
) {
  target?.postMessage(
    { type: EDITOR_PREVIEW_STATE, payload, revision: revision ?? Date.now() },
    '*',
  );
}

export function postEditorSectionSelect(
  target: Window | null | undefined,
  sectionId: EditorSelectableId,
) {
  target?.postMessage({ type: 'grabio:section-select', sectionId }, '*');
}
