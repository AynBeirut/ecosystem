import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money/format';
import { getActualStoreId } from '@/lib/storeUtils';
import { createVPosOrder, type VPosCartLine } from '@/lib/vposOrder';
import {
  findVCustomerByPhone,
  findVCustomersByName,
  loadVCustomers,
  loadVPosProducts,
  type VCustomerLite,
  type VPosProductLite,
} from '@/lib/vOpsCatalog';
import { vOpsCacheGet, vOpsCacheKey } from '@/lib/vOpsCache';

function cartKey(productId: string) {
  return productId;
}

export default function AdminVPos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user) || user?.storeId || '';

  const [products, setProducts] = useState<VPosProductLite[]>(() =>
    storeId ? vOpsCacheGet<VPosProductLite[]>(vOpsCacheKey('products', storeId)) || [] : [],
  );
  const [customers, setCustomers] = useState<VCustomerLite[]>(() =>
    storeId ? vOpsCacheGet<VCustomerLite[]>(vOpsCacheKey('customers', storeId)) || [] : [],
  );
  const [loadingProducts, setLoadingProducts] = useState(() => products.length === 0);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<VCustomerLite[]>([]);
  const [cart, setCart] = useState<Record<string, VPosCartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastTapId, setLastTapId] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const skipNameSuggestRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('vpos-fullscreen');
    return () => {
      document.documentElement.classList.remove('vpos-fullscreen');
    };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    const cached = vOpsCacheGet<VPosProductLite[]>(vOpsCacheKey('products', storeId));
    if (cached?.length) {
      setProducts(cached);
      setLoadingProducts(false);
    } else {
      setLoadingProducts(true);
    }

    void loadVCustomers(storeId)
      .then((rows) => {
        if (!cancelled) setCustomers(rows);
      })
      .catch(() => undefined);

    if (cached?.length) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const rows = await loadVPosProducts(storeId);
        if (!cancelled) setProducts(rows);
      } catch (error) {
        console.error('V·POS product load failed:', error);
        if (!cancelled) {
          toast({
            title: 'Could not load products',
            description: 'Refresh and try again.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, toast]);

  const applyMatchedCustomer = (row: VCustomerLite) => {
    skipNameSuggestRef.current = true;
    setMatchedCustomerId(row.id);
    setCustomerName(row.name);
    setCustomerPhone(row.phone);
    setNameSuggestions([]);
  };

  const onCustomerPhoneChange = (value: string) => {
    setCustomerPhone(value);
    setMatchedCustomerId(null);
    const hit = findVCustomerByPhone(customers, value);
    if (hit) {
      skipNameSuggestRef.current = true;
      setMatchedCustomerId(hit.id);
      setCustomerName(hit.name);
      setNameSuggestions([]);
    }
  };

  const onCustomerNameChange = (value: string) => {
    setCustomerName(value);
    setMatchedCustomerId(null);
    if (skipNameSuggestRef.current) {
      skipNameSuggestRef.current = false;
      setNameSuggestions([]);
      return;
    }
    setNameSuggestions(findVCustomersByName(customers, value));
  };

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines],
  );
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartLines],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        String(product.category || '').toLowerCase().includes(q),
    );
  }, [products, search]);

  const addProduct = (product: VPosProductLite) => {
    const key = cartKey(product.id);
    setLastTapId(product.id);
    window.setTimeout(() => setLastTapId(null), 180);

    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: (existing?.quantity || 0) + 1,
        },
      };
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const key = cartKey(productId);
      const existing = prev[key];
      if (!existing) return prev;

      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }

      return {
        ...prev,
        [key]: { ...existing, quantity: nextQty },
      };
    });
  };

  const clearCart = () => {
    setCart({});
    setCartOpen(false);
  };

  const submitOrder = async (markPaid: boolean) => {
    if (!storeId || !user?.id || !cartLines.length || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await createVPosOrder({
        storeId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        items: cartLines,
        customer: {
          id: matchedCustomerId || undefined,
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined,
        },
        markPaid,
      });

      toast({
        title: markPaid ? 'Sale complete' : 'Order saved',
        description: `${result.invoiceNumber} · ${formatMoney(result.total, { currency: 'USD' })} · ${result.customerName}`,
      });

      setCart({});
      setCartOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setMatchedCustomerId(null);
      setNameSuggestions([]);
    } catch (error) {
      console.error('V·POS order failed:', error);
      toast({
        title: 'Order failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-background px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            asChild
          >
            <Link to="/admin/dashboard" aria-label="Back to dashboard">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu..."
              className="h-11 pl-9 text-base"
              inputMode="search"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="relative mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={customerName}
              onChange={(event) => onCustomerNameChange(event.target.value)}
              onBlur={() => {
                window.setTimeout(() => setNameSuggestions([]), 150);
              }}
              placeholder="Client name (optional)"
              className={cn('h-11 text-base', matchedCustomerId && 'border-emerald-500')}
              autoComplete="off"
            />
            <Input
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="Phone (optional)"
              className={cn('h-11 text-base', matchedCustomerId && 'border-emerald-500')}
              inputMode="tel"
              autoComplete="off"
            />
          </div>
          {matchedCustomerId ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">Existing client loaded</p>
          ) : null}
          {nameSuggestions.length > 0 ? (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border bg-background shadow-lg">
              {nameSuggestions.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyMatchedCustomer(row)}
                  >
                    <span className="text-sm font-medium">{row.name}</span>
                    {row.phone ? (
                      <span className="text-xs text-muted-foreground">{row.phone}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 pb-40">
        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No priced products found. Add sale prices in Products first.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const qty = cart[cartKey(product.id)]?.quantity || 0;
              const tapped = lastTapId === product.id;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className={cn(
                    'relative min-h-[5.75rem] rounded-2xl border bg-card px-3 py-3 text-left shadow-sm transition active:scale-[0.98]',
                    qty > 0 && 'border-teal-500/60 bg-teal-500/5',
                    tapped && 'ring-2 ring-teal-500/70',
                  )}
                >
                  {qty > 0 ? (
                    <span className="absolute right-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-1 text-xs font-bold text-white">
                      {qty}
                    </span>
                  ) : null}
                  <span className="block pr-6 text-sm font-semibold leading-snug line-clamp-3">{product.name}</span>
                  {product.dataStatus === 'menu-only' ? (
                    <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-amber-700">
                      Recipe pending
                    </span>
                  ) : null}
                  <span className="mt-2 block text-base font-bold tabular-nums text-teal-700">
                    {formatMoney(product.price, { currency: 'USD' })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className={cn(
            'mb-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left',
            cartCount === 0 && 'opacity-60',
          )}
          onClick={() => cartCount > 0 && setCartOpen(true)}
          disabled={cartCount === 0}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <ShoppingBag className="h-4 w-4" />
            {cartCount} item{cartCount === 1 ? '' : 's'}
          </span>
          <span className="text-lg font-bold tabular-nums">{formatMoney(cartTotal, { currency: 'USD' })}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={cartCount === 0 || submitting}
            onClick={() => submitOrder(false)}
          >
            Save unpaid
          </Button>
          <Button
            type="button"
            className="h-12 bg-teal-600 text-base hover:bg-teal-700"
            disabled={cartCount === 0 || submitting}
            onClick={() => submitOrder(true)}
          >
            Cash · {formatMoney(cartTotal, { currency: 'USD' })}
          </Button>
        </div>
      </div>

      {cartOpen ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => setCartOpen(false)}
              aria-label="Back to menu"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h2 className="flex-1 text-center text-base font-semibold">Current order</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={clearCart}
              disabled={cartCount === 0}
            >
              Clear
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cartLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              <ul className="space-y-3">
                {cartLines.map((line) => (
                  <li key={line.productId} className="rounded-2xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{line.productName}</p>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatMoney(line.price, { currency: 'USD' })} each
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        onClick={() => changeQty(line.productId, -line.quantity)}
                        aria-label={`Remove ${line.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => changeQty(line.productId, -1)}
                          aria-label={`Decrease ${line.productName}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-8 text-center text-lg font-semibold tabular-nums">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => changeQty(line.productId, 1)}
                          aria-label={`Increase ${line.productName}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="text-base font-bold tabular-nums">
                        {formatMoney(line.price * line.quantity, { currency: 'USD' })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(cartTotal, { currency: 'USD' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                disabled={cartCount === 0 || submitting}
                onClick={() => submitOrder(false)}
              >
                Save unpaid
              </Button>
              <Button
                type="button"
                className="h-12 bg-teal-600 hover:bg-teal-700"
                disabled={cartCount === 0 || submitting}
                onClick={() => submitOrder(true)}
              >
                Cash · {formatMoney(cartTotal, { currency: 'USD' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
