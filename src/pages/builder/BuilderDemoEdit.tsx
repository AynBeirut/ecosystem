import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Package, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AdminTemplates from '@/pages/admin/AdminTemplates';
import { useAuth } from '@/context/useAuth';
import { addDemoProduct, listDemoProducts } from '@/lib/builderService';
import type { BuilderDemoProduct } from '@/types/builder';
import { toast } from 'sonner';

type WorkspaceTab = 'design' | 'products';

const BuilderDemoEdit: React.FC = () => {
  const { demoId } = useParams<{ demoId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const builderUid = user?.id;

  const tab = (searchParams.get('tab') as WorkspaceTab) || 'design';
  const setTab = (next: WorkspaceTab) => {
    setSearchParams({ tab: next }, { replace: true });
  };

  const [products, setProducts] = useState<BuilderDemoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('9.99');
  const [addingProduct, setAddingProduct] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!builderUid || !demoId) return;
    setProductsLoading(true);
    try {
      const rows = await listDemoProducts(builderUid, demoId);
      setProducts(rows);
    } catch (err) {
      console.error(err);
      toast.error('Could not load demo products');
    } finally {
      setProductsLoading(false);
    }
  }, [builderUid, demoId]);

  useEffect(() => {
    if (!builderUid || !demoId) {
      navigate('/builder', { replace: true });
    }
  }, [builderUid, demoId, navigate]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleAddProduct = async () => {
    if (!builderUid || !demoId) return;
    setAddingProduct(true);
    try {
      await addDemoProduct(builderUid, demoId, {
        name: productName,
        price: Number(productPrice),
      });
      setProductName('');
      await loadProducts();
      toast.success('Product added to demo catalog');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add product');
    } finally {
      setAddingProduct(false);
    }
  };

  if (!builderUid || !demoId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="border-b bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-teal-700">Demo store editor</p>
            <p className="font-mono text-sm text-slate-700">{demoId}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/builder/demo/${demoId}/preview`} target="_blank" rel="noopener noreferrer">
                Preview demo
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/builder">Back to dashboard</Link>
            </Button>
          </div>
        </div>
        <div className="container mx-auto max-w-6xl px-4 pb-3">
          <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab('design')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all flex-1 justify-center ${
                tab === 'design'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Palette className="h-4 w-4" />
              Design & templates
            </button>
            <button
              type="button"
              onClick={() => setTab('products')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all flex-1 justify-center ${
                tab === 'products'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="h-4 w-4" />
              Products
              {products.length > 0 && (
                <Badge variant="secondary" className="ml-1">{products.length}</Badge>
              )}
            </button>
          </div>
        </div>
      </div>

      {tab === 'design' ? (
        <AdminTemplates demoId={demoId} />
      ) : (
        <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                Demo catalog products
              </CardTitle>
              <CardDescription>
                These live under your builder demo path until you transfer the store to production.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <Input
                placeholder="Product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
              />
              <Button disabled={addingProduct || !productName.trim()} onClick={() => void handleAddProduct()}>
                {addingProduct ? 'Adding…' : 'Add product'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product list</CardTitle>
              <CardDescription>
                {productsLoading ? 'Loading…' : `${products.length} product(s) in this demo`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-sm text-slate-600 py-6 text-center">
                  No products yet. Add one above — they will appear here immediately.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border bg-white">
                  {products.map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.description ? (
                          <p className="text-sm text-slate-500">{product.description}</p>
                        ) : null}
                      </div>
                      <p className="font-semibold text-slate-800">${Number(product.price).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BuilderDemoEdit;
