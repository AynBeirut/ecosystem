import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDoc, doc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getDemoBranding, listDemoProducts } from '@/lib/builderService';
import type { BuilderDemoBranding, BuilderDemoProduct } from '@/types/builder';
import type { StoreTemplateColors } from '@/types/storeProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import PoweredByEmoove from '@/components/PoweredByEmoove';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const builderUid = user?.id;

  const [branding, setBranding] = useState<(BuilderDemoBranding & { templateColors?: StoreTemplateColors }) | null>(null);
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

  const colors = useMemo(() => {
    const raw = branding?.templateColors;
    if (!raw || typeof raw !== 'object') return DEFAULT_COLORS;
    return { ...DEFAULT_COLORS, ...raw };
  }, [branding]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  const title = branding?.name || demoName || 'Demo Store';

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
              {branding?.slogan ? <p className="text-white/90">{branding.slogan}</p> : null}
              {branding?.description ? (
                <p className="text-sm text-white/80 max-w-2xl">{branding.description}</p>
              ) : null}
              <p className="text-xs text-white/70 font-mono">
                template: {branding?.template || 'default'}
                {branding?.slug ? ` · slug: ${branding.slug}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link to={`/builder/demo/${demoId}/edit?tab=design`}>Back to editor</Link>
              </Button>
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                <Link to="/builder">Dashboard</Link>
              </Button>
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
