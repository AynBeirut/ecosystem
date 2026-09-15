import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getDoc, doc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getDemoBranding, listDemoProducts } from '@/lib/builderService';
import type { BuilderDemoBranding, BuilderDemoProduct } from '@/types/builder';
import type { StoreTemplateColors } from '@/types/storeProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import BuilderWorkspaceNav from '@/components/builder/BuilderWorkspaceNav';
import {
  EDITOR_PREVIEW_READY,
  EDITOR_PREVIEW_STATE,
  isEditorPreviewActive,
  type EditorPreviewStatePayload,
} from '@/lib/editorPreviewBridge';

const db = getFirestore();

const DEFAULT_COLORS: Required<StoreTemplateColors> = {
  primary: '#38B2AC',
  secondary: '#2C5282',
  accent: '#ED8936',
  background: '#f0fdfd',
  surface: '#ffffff',
  textColor: '#1a202c',
  highlight: '#22d3ee',
};

const BuilderDemoPreview: React.FC = () => {
  const { demoId } = useParams<{ demoId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const builderUid = user?.id;
  const editorPreview = isEditorPreviewActive(searchParams);

  const [branding, setBranding] = useState<(BuilderDemoBranding & { templateColors?: StoreTemplateColors }) | null>(null);
  const [livePreview, setLivePreview] = useState<EditorPreviewStatePayload | null>(null);
  const [products, setProducts] = useState<BuilderDemoProduct[]>([]);
  const [demoName, setDemoName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!builderUid || !demoId) {
      navigate('/builder', { replace: true });
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [brand, catalog, demoSnap] = await Promise.all([
          getDemoBranding(builderUid, demoId),
          listDemoProducts(builderUid, demoId),
          getDoc(doc(db, 'builders', builderUid, 'demoStores', demoId)),
        ]);
        setBranding(brand as BuilderDemoBranding & { templateColors?: StoreTemplateColors });
        setProducts(catalog);
        setDemoName(demoSnap.exists() ? String(demoSnap.data()?.name || '') : '');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [builderUid, demoId, navigate]);

  useEffect(() => {
    if (!editorPreview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === EDITOR_PREVIEW_STATE && event.data.payload) {
        setLivePreview(event.data.payload as EditorPreviewStatePayload);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: EDITOR_PREVIEW_READY }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [editorPreview]);

  const colors = useMemo(() => {
    const raw = livePreview?.content?.templateColors || branding?.templateColors;
    if (!raw || typeof raw !== 'object') return DEFAULT_COLORS;
    return { ...DEFAULT_COLORS, ...raw };
  }, [branding, livePreview?.content?.templateColors]);

  const title = branding?.name || demoName || 'Demo Store';
  const subtitle = livePreview?.content?.slogan || branding?.slogan || branding?.description || 'Demo storefront preview';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.background, color: colors.textColor }}>
      <div
        className="border-b"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          color: '#fff',
        }}
      >
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Demo preview — not live until transfer
              </Badge>
              <h1 className="text-3xl font-bold">{title}</h1>
              {subtitle ? <p className="text-white/90">{subtitle}</p> : null}
              <p className="text-xs text-white/70 font-mono">
                template: {branding?.template || 'default'}
                {branding?.slug ? ` · slug: ${branding.slug}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!editorPreview && (
                <Button variant="secondary" asChild>
                  <Link to={`/builder/demo/${demoId}/edit?tab=classic`}>Back to editor</Link>
                </Button>
              )}
              <BuilderWorkspaceNav compact showDemoWorkspaceLink />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Products</h2>
          <span className="text-sm opacity-70">{products.length} item(s)</span>
        </div>

        {products.length === 0 ? (
          <Card style={{ background: colors.surface, borderColor: `${colors.primary}33` }}>
            <CardContent className="py-10 text-center text-sm opacity-70">
              No demo products yet. Add products in the editor, then refresh this preview.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden"
                style={{ background: colors.surface, borderColor: `${colors.primary}22` }}
              >
                <div
                  className="h-32 flex items-center justify-center text-4xl"
                  style={{ background: `${colors.highlight}33` }}
                >
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    '🛍️'
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold">{product.name}</p>
                  {product.description ? (
                    <p className="text-sm opacity-70 line-clamp-2">{product.description}</p>
                  ) : null}
                  <p className="text-lg font-bold" style={{ color: colors.primary }}>
                    ${Number(product.price).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="pb-8">
        <PoweredByEmoove />
      </div>
    </div>
  );
};

export default BuilderDemoPreview;
