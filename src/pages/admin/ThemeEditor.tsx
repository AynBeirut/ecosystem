import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Save,
  Smartphone,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SectionTreePanel from '@/components/builder/SectionTreePanel';
import SectionSettingsPanel from '@/components/builder/SectionSettingsPanel';
import StoreContentPanel from '@/components/builder/StoreContentPanel';
import ThemePickerPanel from '@/components/builder/ThemePickerPanel';
import BuilderPublishConfirmDialog from '@/components/builder/BuilderPublishConfirmDialog';
import { EditorSidebarRail } from '@/components/builder/EditorSidebarRail';
import FreelancerClientBackButton from '@/components/freelancer/FreelancerClientBackButton';
import { useAuth } from '@/context/useAuth';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { isWebBuilderSubAccount } from '@/lib/webBuilderAccess';
import { mergeSectionOrderFromProfile } from '@/lib/storeSectionDefaults';
import {
  buildEditorPreviewSrc,
  defaultEditorLayoutDraft,
  EDITOR_PREVIEW_READY,
  postEditorPreviewState,
  type EditorLayoutDraft,
  type EditorSelectableId,
  type EditorThemeDraft,
} from '@/lib/editorPreviewBridge';
import {
  buildDemoEditorPreviewSrc,
  loadDemoThemeProfile,
  saveDemoThemeProfile,
  uploadDemoMedia,
} from '@/lib/demoThemeEditor';
import {
  buildThemeProfilePatch,
  themeDisplayName,
  type StoreThemeId,
} from '@/lib/storeThemeCatalog';
import {
  uploadGalleryImage,
  uploadStoreBannerImage,
} from '@/lib/storeMediaUpload';
import type { StoreSectionOrder, RatingDisplayType, StoreProfile } from '@/types/storeProfile';
import {
  contentDraftFromProfile,
  contentDraftToFirestorePatch,
  mergeTemplateColors,
  type StoreContentDraft,
} from '@/lib/storeContentDraft';

type DeviceMode = 'desktop' | 'mobile';
type LeftPanelTab = 'themes' | 'sections' | 'content';

type ThemeEditorProps = {
  /** Builder demo workspace — persist under builders/{uid}/demoStores/{demoId} */
  demoId?: string;
  onExit?: () => void;
};

const ThemeEditor: React.FC<ThemeEditorProps> = ({ demoId, onExit }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isWebBuilder = isWebBuilderSubAccount(user);
  const demoMode = Boolean(demoId && user?.id);
  const builderUid = user?.id;
  const { profile, storeId, loading, reload } = useStoreEntitlements();
  const [demoProfile, setDemoProfile] = useState<Partial<StoreProfile> | null>(null);
  const [demoLoading, setDemoLoading] = useState(Boolean(demoId));
  const [sectionOrder, setSectionOrder] = useState<StoreSectionOrder[]>([]);
  const [layoutDraft, setLayoutDraft] = useState<EditorLayoutDraft>(defaultEditorLayoutDraft());
  const [selectedId, setSelectedId] = useState<EditorSelectableId | null>('store_header');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [contentDraft, setContentDraft] = useState<StoreContentDraft>({});
  const [themeDraft, setThemeDraft] = useState<EditorThemeDraft>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('themes');
  const [previewVersion, setPreviewVersion] = useState(0);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const previewStateRef = useRef({ sectionOrder, layout: layoutDraft, content: contentDraft, theme: themeDraft });
  const previewRevisionRef = useRef(0);

  const activeProfile = demoMode ? demoProfile : profile;
  const activeStoreId = demoMode ? demoId : storeId;
  const profileLoading = demoMode ? demoLoading : loading;

  useEffect(() => {
    if (!demoMode || !builderUid || !demoId) return;
    let cancelled = false;
    setDemoLoading(true);
    void loadDemoThemeProfile(builderUid, demoId)
      .then((next) => {
        if (!cancelled) setDemoProfile(next);
      })
      .finally(() => {
        if (!cancelled) setDemoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode, builderUid, demoId]);

  const reloadDemoProfile = useCallback(async () => {
    if (!builderUid || !demoId) return;
    const next = await loadDemoThemeProfile(builderUid, demoId);
    setDemoProfile(next);
  }, [builderUid, demoId]);

  useEffect(() => {
    previewStateRef.current = { sectionOrder, layout: layoutDraft, content: contentDraft, theme: themeDraft };
  }, [sectionOrder, layoutDraft, contentDraft, themeDraft]);

  const pushPreviewToIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    previewRevisionRef.current += 1;
    postEditorPreviewState(
      win,
      {
        sectionOrder: previewStateRef.current.sectionOrder,
        layout: previewStateRef.current.layout,
        content: previewStateRef.current.content,
        theme: previewStateRef.current.theme,
      },
      previewRevisionRef.current,
    );
  }, []);

  useEffect(() => {
    if (!activeProfile || dirty) return;
    const nextSections = mergeSectionOrderFromProfile(activeProfile.sectionOrder);
    const nextLayout = defaultEditorLayoutDraft(activeProfile);
    const nextContent = contentDraftFromProfile(activeProfile);
    const nextTheme: EditorThemeDraft = {
      template: activeProfile.template,
      heroLayout: activeProfile.heroLayout,
      productDisplayType: activeProfile.productDisplayType,
      productCardAnimation: activeProfile.productCardAnimation,
      aboutLayout: activeProfile.aboutLayout,
      contactFormStyle: activeProfile.contactFormStyle,
      ratingDisplayType: activeProfile.ratingDisplayType,
      pageLayout: activeProfile.pageLayout,
      visualStyle: activeProfile.visualStyle,
    };
    setSectionOrder(nextSections);
    setLayoutDraft(nextLayout);
    setContentDraft(nextContent);
    setThemeDraft(nextTheme);
    previewStateRef.current = {
      sectionOrder: nextSections,
      layout: nextLayout,
      content: nextContent,
      theme: nextTheme,
    };
  }, [activeProfile, dirty]);

  const previewPath = useMemo(() => {
    if (!activeStoreId) return null;
    if (demoMode) return buildDemoEditorPreviewSrc(activeStoreId, previewVersion);
    return buildEditorPreviewSrc(activeStoreId, activeProfile?.slug || activeProfile?.storeSlug, previewVersion);
  }, [activeProfile?.slug, activeProfile?.storeSlug, activeStoreId, demoMode, previewVersion]);

  const selectedSection = !selectedId || selectedId === 'store_header' || selectedId === 'navigation'
    ? null
    : sectionOrder.find((s) => s.id === selectedId) ?? null;
  const activeThemeId = activeProfile?.template as string | undefined;

  const handleSectionsChange = useCallback(
    (next: StoreSectionOrder[]) => {
      previewStateRef.current = { ...previewStateRef.current, sectionOrder: next };
      setSectionOrder(next);
      setDirty(true);
      pushPreviewToIframe();
    },
    [pushPreviewToIframe],
  );

  const handleLayoutChange = useCallback(
    (patch: Partial<EditorLayoutDraft>) => {
      setLayoutDraft((prev) => {
        const layout = { ...prev, ...patch };
        previewStateRef.current = { ...previewStateRef.current, layout };
        return layout;
      });
      setDirty(true);
      pushPreviewToIframe();
    },
    [pushPreviewToIframe],
  );

  useEffect(() => {
    pushPreviewToIframe();
  }, [pushPreviewToIframe, previewVersion]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === EDITOR_PREVIEW_READY) {
        pushPreviewToIframe();
        return;
      }
      if (event.data?.type === 'grabio:section-select' && event.data.sectionId) {
        setSelectedId(event.data.sectionId as EditorSelectableId);
        setLeftTab('sections');
        if (!leftOpen) setLeftOpen(true);
        if (!rightOpen) setRightOpen(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [leftOpen, rightOpen, pushPreviewToIframe]);

  useEffect(() => {
    if (!selectedId) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'grabio:section-highlight', sectionId: selectedId },
      '*',
    );
  }, [selectedId, previewPath, pushPreviewToIframe]);

  const handleContentChange = useCallback((patch: Partial<StoreContentDraft>) => {
    setContentDraft((prev) => {
      const content = {
        ...prev,
        ...patch,
        ...(patch.templateColors
          ? { templateColors: mergeTemplateColors(activeProfile?.templateColors ?? prev.templateColors, patch.templateColors) }
          : {}),
      };
      previewStateRef.current = { ...previewStateRef.current, content };
      return content;
    });
    setDirty(true);
    pushPreviewToIframe();
  }, [pushPreviewToIframe, activeProfile?.templateColors]);

  const handleRatingDisplayChange = useCallback((v: RatingDisplayType) => {
    handleContentChange({ ratingDisplayType: v });
  }, [handleContentChange]);

  const handleHeroBannerUpload = useCallback(
    async (file: File) => {
      if (!activeStoreId) return;
      if (demoMode && builderUid && demoId) {
        const url = await uploadDemoMedia(builderUid, demoId, 'background', file);
        await saveDemoThemeProfile(builderUid, demoId, { storeBackgroundImage: url });
        await reloadDemoProfile();
        pushPreviewToIframe();
        return;
      }
      const url = await uploadStoreBannerImage(activeStoreId, file);
      await setDoc(
        doc(getFirestore(), 'storeProfiles', activeStoreId),
        { storeBackgroundImage: url, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      await reload({ silent: true });
      pushPreviewToIframe();
    },
    [activeStoreId, demoMode, builderUid, demoId, reload, reloadDemoProfile, pushPreviewToIframe],
  );

  const handleGalleryUpload = useCallback(
    async (file: File) => {
      if (!activeStoreId) return;
      if (demoMode && builderUid && demoId) {
        const url = await uploadDemoMedia(builderUid, demoId, 'gallery', file);
        const next = [...(activeProfile?.galleryImages || []), url].slice(0, 24);
        await saveDemoThemeProfile(builderUid, demoId, { galleryImages: next });
        await reloadDemoProfile();
        pushPreviewToIframe();
        return;
      }
      const url = await uploadGalleryImage(activeStoreId, file);
      const next = [...(activeProfile?.galleryImages || []), url].slice(0, 24);
      await setDoc(
        doc(getFirestore(), 'storeProfiles', activeStoreId),
        { galleryImages: next, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      await reload({ silent: true });
      pushPreviewToIframe();
    },
    [activeStoreId, activeProfile?.galleryImages, demoMode, builderUid, demoId, reload, reloadDemoProfile, pushPreviewToIframe],
  );

  const handleApplyTheme = async (themeId: StoreThemeId) => {
    if (!activeStoreId) return;
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const patch = buildThemeProfilePatch(themeId, {
        includeDemoMedia: true,
        hasExistingHero: Boolean(activeProfile?.storeBackgroundImage),
      });
      if (demoMode && builderUid && demoId) {
        await saveDemoThemeProfile(builderUid, demoId, { ...patch, updatedAt: timestamp });
      } else {
        await setDoc(
          doc(getFirestore(), 'storeProfiles', activeStoreId),
          { ...patch, updatedAt: timestamp },
          { merge: true },
        );
      }

      const mergedColors = mergeTemplateColors(
        activeProfile?.templateColors,
        patch.templateColors as StoreContentDraft['templateColors'],
      );
      const nextLayout: EditorLayoutDraft = {
        ...layoutDraft,
        menuStyle: (patch.menuStyle as EditorLayoutDraft['menuStyle']) ?? layoutDraft.menuStyle,
        storeCardStyle: (patch.storeCardStyle as EditorLayoutDraft['storeCardStyle']) ?? layoutDraft.storeCardStyle,
      };
      const nextContent: StoreContentDraft = {
        ...contentDraft,
        templateColors: mergedColors,
        ratingDisplayType:
          (patch.ratingDisplayType as StoreContentDraft['ratingDisplayType']) ?? contentDraft.ratingDisplayType,
      };
      const nextTheme: EditorThemeDraft = {
        template: patch.template as string,
        heroLayout: patch.heroLayout as EditorThemeDraft['heroLayout'],
        productDisplayType: patch.productDisplayType as EditorThemeDraft['productDisplayType'],
        productCardAnimation: patch.productCardAnimation as EditorThemeDraft['productCardAnimation'],
        aboutLayout: patch.aboutLayout as EditorThemeDraft['aboutLayout'],
        contactFormStyle: patch.contactFormStyle as EditorThemeDraft['contactFormStyle'],
        ratingDisplayType: patch.ratingDisplayType as EditorThemeDraft['ratingDisplayType'],
        pageLayout: patch.pageLayout as EditorThemeDraft['pageLayout'],
        visualStyle: patch.visualStyle as EditorThemeDraft['visualStyle'],
      };

      setLayoutDraft(nextLayout);
      setContentDraft(nextContent);
      setThemeDraft(nextTheme);
      previewStateRef.current = { sectionOrder, layout: nextLayout, content: nextContent, theme: nextTheme };
      pushPreviewToIframe();
      if (demoMode) {
        await reloadDemoProfile();
      } else {
        await reload({ silent: true });
      }
      toast.success(`Theme applied: ${themeDisplayName(themeId)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply theme');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (publish = false) => {
    if (!activeStoreId) return;
    if (demoMode && publish) {
      publish = false;
    }
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const patch = {
        sectionOrder,
        menuStyle: layoutDraft.menuStyle,
        storeCardStyle: layoutDraft.storeCardStyle,
        ...contentDraftToFirestorePatch(contentDraft, activeProfile?.templateColors),
        ...(publish ? { status: 'online' } : {}),
        updatedAt: timestamp,
      };
      if (demoMode && builderUid && demoId) {
        await saveDemoThemeProfile(builderUid, demoId, patch);
        await reloadDemoProfile();
      } else {
        await setDoc(doc(getFirestore(), 'storeProfiles', activeStoreId), patch, { merge: true });
        await reload({ silent: true });
      }
      setDirty(false);
      toast.success(demoMode ? 'Demo layout saved' : publish ? 'Store published' : 'Layout saved');
      pushPreviewToIframe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading && !activeProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#616161]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f6f6f7] text-[#303030] overflow-hidden">
      <header className="shrink-0 flex items-center gap-3 px-3 py-2 bg-[#1a1a1a] text-white border-b border-black/20">
        {demoMode ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 gap-1.5"
            onClick={() => (onExit ? onExit() : navigate(`/builder/demo/${demoId}/edit?tab=classic`))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to demo
          </Button>
        ) : isWebBuilder ? (
          <FreelancerClientBackButton variant="header" />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 gap-1.5"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>
        )}
        <div className="h-5 w-px bg-white/20" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{activeProfile?.name || 'Store'}</span>
          <Badge
            variant="secondary"
            className="bg-white/15 text-white border-0 text-[10px] uppercase tracking-wide"
          >
            {demoMode ? 'Demo' : activeProfile?.status === 'online' ? 'Live' : 'Draft'}
          </Badge>
          <span className="text-white/50 text-xs hidden sm:inline">·</span>
          <button
            type="button"
            onClick={() => {
              setLeftOpen(true);
              setLeftTab('themes');
            }}
            className="text-white/80 text-xs hidden sm:inline hover:text-white hover:underline"
            title="Change theme"
          >
            {themeDisplayName(activeThemeId)}
          </button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-0.5">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-md ${device === 'desktop' ? 'bg-white text-[#303030]' : 'text-white/80 hover:text-white'}`}
            title="Desktop"
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-md ${device === 'mobile' ? 'bg-white text-[#303030]' : 'text-white/80 hover:text-white'}`}
            title="Mobile"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
        {previewPath && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 hidden md:inline-flex"
            asChild
          >
            <a href={previewPath?.replace(/\?.*$/, '') || '#'} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              View store
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/15 text-white border-0 hover:bg-white/25"
          disabled={saving || !dirty}
          onClick={() => void handleSave(false)}
        >
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        {!demoMode && (
          <Button
            size="sm"
            className="bg-white text-[#303030] hover:bg-white/90"
            disabled={saving}
            onClick={() => setPublishConfirmOpen(true)}
          >
            Publish
          </Button>
        )}
      </header>

      <BuilderPublishConfirmDialog
        open={publishConfirmOpen && !demoMode}
        onOpenChange={setPublishConfirmOpen}
        isLive={activeProfile?.status === 'online'}
        onConfirm={() => {
          setPublishConfirmOpen(false);
          void handleSave(true);
        }}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        {leftOpen ? (
          <div
            className={`shrink-0 hidden md:flex flex-col min-h-0 border-r border-[#e3e3e5] ${
              leftTab === 'themes' ? 'w-[min(100%,400px)]' : leftTab === 'content' ? 'w-[280px]' : 'w-[240px]'
            }`}
          >
            <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-b border-[#e3e3e5]">
              <button
                type="button"
                onClick={() => setLeftTab('themes')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${
                  leftTab === 'themes' ? 'bg-[#303030] text-white' : 'text-[#616161] hover:bg-[#f6f6f7]'
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                Themes
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('sections')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-medium ${
                  leftTab === 'sections' ? 'bg-[#303030] text-white' : 'text-[#616161] hover:bg-[#f6f6f7]'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Sections
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('content')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-medium ${
                  leftTab === 'content' ? 'bg-[#303030] text-white' : 'text-[#616161] hover:bg-[#f6f6f7]'
                }`}
              >
                <Type className="h-3.5 w-3.5" />
                Content
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[#616161]"
                onClick={() => setLeftOpen(false)}
                title="Hide left panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {leftTab === 'themes' ? (
                <ThemePickerPanel
                  activeThemeId={activeThemeId}
                  applying={saving}
                  onSelect={(id) => void handleApplyTheme(id)}
                />
              ) : leftTab === 'content' ? (
                <StoreContentPanel draft={contentDraft} onChange={handleContentChange} />
              ) : (
                <SectionTreePanel
                  sections={sectionOrder}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={handleSectionsChange}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:block">
            <EditorSidebarRail side="left" label="Panels" onExpand={() => setLeftOpen(true)} />
          </div>
        )}

        {/* Preview */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#e8e8e8] relative">
          {!leftOpen && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-2 z-10 h-8 w-8 shadow-md md:hidden"
              onClick={() => setLeftOpen(true)}
              title="Show panels"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 flex items-start justify-center overflow-auto p-4 md:p-6">
            {previewPath ? (
              <div
                className={`bg-white shadow-2xl transition-all duration-300 h-full ${
                  device === 'mobile'
                    ? 'w-[390px] max-w-full rounded-[2rem] border-[10px] border-[#303030]'
                    : 'w-full max-w-5xl rounded-lg border border-[#d4d4d4]'
                }`}
                style={{ minHeight: device === 'mobile' ? '700px' : '100%' }}
              >
                <iframe
                  key={previewPath}
                  ref={iframeRef}
                  name="grabio-theme-preview"
                  title="Store preview"
                  src={previewPath}
                  onLoad={pushPreviewToIframe}
                  className="w-full h-full min-h-[600px] rounded-[inherit] bg-white"
                />
              </div>
            ) : (
              <p className="text-sm text-[#616161]">Store preview unavailable — set a store name and slug first.</p>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        {rightOpen ? (
          <div className="w-[280px] shrink-0 hidden lg:flex flex-col min-h-0 relative overflow-visible">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0 top-2 -translate-x-1/2 z-10 h-7 w-7 rounded-full border bg-white shadow-sm text-[#616161]"
              onClick={() => setRightOpen(false)}
              title="Hide settings panel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <SectionSettingsPanel
              selectedId={selectedId}
              section={selectedSection}
              sections={sectionOrder}
              layoutDraft={layoutDraft}
              storeId={storeId}
              storeBackgroundImage={profile?.storeBackgroundImage}
              galleryImages={profile?.galleryImages}
              onChange={handleSectionsChange}
              onLayoutChange={handleLayoutChange}
              onHeroBannerUpload={handleHeroBannerUpload}
              onGalleryUpload={handleGalleryUpload}
              ratingDisplayType={contentDraft.ratingDisplayType ?? profile?.ratingDisplayType ?? 'stars'}
              onRatingDisplayChange={handleRatingDisplayChange}
            />
          </div>
        ) : (
          <div className="hidden lg:block">
            <EditorSidebarRail side="right" label="Settings" onExpand={() => setRightOpen(true)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeEditor;
