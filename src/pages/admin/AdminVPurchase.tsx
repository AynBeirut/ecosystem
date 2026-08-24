import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronsUpDown, Minus, Plus, ScanLine, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money/format';
import { getActualStoreId } from '@/lib/storeUtils';
import { createVPurchase, type VPurchaseLine } from '@/lib/vPurchase';
import { ensureOcrMaterial, ensureOcrSupplier } from '@/lib/ocrEnsure';
import type { OcrPurchaseSave } from '@/features/ocr';
import {
  loadVMaterials,
  loadVSuppliers,
  type VMaterialLite,
  type VSupplierLite,
} from '@/lib/vOpsCatalog';
import { vOpsCacheGet, vOpsCacheKey, vOpsCacheSet } from '@/lib/vOpsCache';

const OcrReceiptFlow = lazy(() =>
  import('@/features/ocr').then((m) => ({ default: m.OcrReceiptFlow })),
);

type CartLine = VPurchaseLine;

export default function AdminVPurchase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user) || user?.storeId || '';

  const [materials, setMaterials] = useState<VMaterialLite[]>(() =>
    storeId ? vOpsCacheGet<VMaterialLite[]>(vOpsCacheKey('materials', storeId)) || [] : [],
  );
  const [suppliers, setSuppliers] = useState<VSupplierLite[]>(() =>
    storeId ? vOpsCacheGet<VSupplierLite[]>(vOpsCacheKey('suppliers', storeId)) || [] : [],
  );
  const [loading, setLoading] = useState(() => materials.length === 0);
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastTapId, setLastTapId] = useState<string | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingMaterial, setCreatingMaterial] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('vpos-fullscreen');
    return () => {
      document.documentElement.classList.remove('vpos-fullscreen');
    };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    const cachedMats = vOpsCacheGet<VMaterialLite[]>(vOpsCacheKey('materials', storeId));
    const cachedSup = vOpsCacheGet<VSupplierLite[]>(vOpsCacheKey('suppliers', storeId));
    if (cachedMats?.length) setMaterials(cachedMats);
    if (cachedSup?.length) setSuppliers(cachedSup);
    if (cachedMats?.length) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const [mats, sups] = await Promise.all([loadVMaterials(storeId), loadVSuppliers(storeId)]);
        if (cancelled) return;
        setMaterials(mats);
        setSuppliers(sups);
      } catch (error) {
        console.error('V·Purchase load failed:', error);
        if (!cancelled) toast({ title: 'Could not load data', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, toast]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.quantity, 0), [cartLines]);
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + l.unitCost * l.quantity, 0),
    [cartLines],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) => m.name.toLowerCase().includes(q) || String(m.sku || '').toLowerCase().includes(q),
    );
  }, [materials, search]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);

  const selectedSupplierName = suppliers.find((s) => s.id === supplierId)?.name || '';

  const canCreateSupplier = useMemo(() => {
    const q = supplierQuery.trim();
    if (q.length < 2) return false;
    return !suppliers.some((s) => s.name.trim().toLowerCase() === q.toLowerCase());
  }, [supplierQuery, suppliers]);

  const canCreateMaterial = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return false;
    return !materials.some((m) => m.name.trim().toLowerCase() === q.toLowerCase());
  }, [materials, search]);

  const appendMaterial = (lite: VMaterialLite) => {
    if (materials.some((m) => m.id === lite.id)) return;
    const next = [...materials, lite].sort((a, b) => a.name.localeCompare(b.name));
    setMaterials(next);
    vOpsCacheSet(vOpsCacheKey('materials', storeId), next);
  };

  const resolveOrCreateMaterial = async (nameHint: string, unitCost = 0): Promise<VMaterialLite> => {
    const name = nameHint.trim();
    if (!name) throw new Error('Material name required');
    const created = await ensureOcrMaterial({
      storeId,
      name,
      unitCost,
      existing: materials,
      existingCount: materials.length,
      source: 'v-purchase',
    });
    const lite: VMaterialLite = {
      id: created.id,
      name: created.name,
      sku: created.sku || '',
      unit: created.unit || 'piece',
      costPerUnit: unitCost,
    };
    appendMaterial(lite);
    return lite;
  };

  const handleCreateMaterialFromSearch = async () => {
    const name = search.trim();
    if (!name || !storeId || creatingMaterial) return;
    setCreatingMaterial(true);
    try {
      const material = await resolveOrCreateMaterial(name, 0);
      addMaterial(material);
      setSearch('');
      toast({ title: 'Material ready', description: `${material.name} — set unit price in cart` });
    } catch (error) {
      toast({
        title: 'Could not create material',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setCreatingMaterial(false);
    }
  };

  const resolveOrCreateSupplier = async (nameHint?: string): Promise<string> => {
    if (supplierId) return supplierId;
    const name = (nameHint || supplierQuery || selectedSupplierName).trim();
    if (!name) throw new Error('Select or type a supplier name');
    const created = await ensureOcrSupplier({
      storeId,
      name,
      existing: suppliers,
      source: 'v-purchase',
    });
    if (!suppliers.some((s) => s.id === created.id)) {
      const next = [...suppliers, created];
      setSuppliers(next);
      vOpsCacheSet(vOpsCacheKey('suppliers', storeId), next);
    }
    setSupplierId(created.id);
    return created.id;
  };

  const handleCreateSupplierFromQuery = async () => {
    const name = supplierQuery.trim();
    if (!name || !storeId || creatingSupplier) return;
    setCreatingSupplier(true);
    try {
      const id = await resolveOrCreateSupplier(name);
      setSupplierId(id);
      setSupplierOpen(false);
      setSupplierQuery('');
      toast({ title: 'Supplier ready', description: name });
    } catch (error) {
      toast({
        title: 'Could not create supplier',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setCreatingSupplier(false);
    }
  };

  const addMaterial = (material: VMaterialLite) => {
    setLastTapId(material.id);
    window.setTimeout(() => setLastTapId(null), 180);
    setCart((prev) => {
      const existing = prev[material.id];
      return {
        ...prev,
        [material.id]: {
          materialId: material.id,
          materialName: material.name,
          sku: material.sku || '',
          unit: material.unit || 'piece',
          unitCost: existing?.unitCost ?? material.costPerUnit,
          quantity: (existing?.quantity || 0) + 1,
        },
      };
    });
  };

  const changeQty = (materialId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[materialId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[materialId];
        return next;
      }
      return { ...prev, [materialId]: { ...existing, quantity: nextQty } };
    });
  };

  const setLineCost = (materialId: string, unitCost: number) => {
    setCart((prev) => {
      const existing = prev[materialId];
      if (!existing) return prev;
      return { ...prev, [materialId]: { ...existing, unitCost: Math.max(0, unitCost) } };
    });
  };

  const clearCart = () => {
    setCart({});
    setCartOpen(false);
  };

  const submit = async (markPaid: boolean) => {
    if (!storeId || !user?.id || !cartLines.length || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const resolvedSupplierId = await resolveOrCreateSupplier();
      const resolvedItems: VPurchaseLine[] = [];
      for (const line of cartLines) {
        if (line.materialId) {
          resolvedItems.push(line);
          continue;
        }
        const material = await resolveOrCreateMaterial(line.materialName, line.unitCost);
        resolvedItems.push({
          ...line,
          materialId: material.id,
          sku: material.sku,
          unit: material.unit,
        });
      }
      const result = await createVPurchase({
        storeId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        supplierId: resolvedSupplierId,
        items: resolvedItems,
        markPaid,
      });
      toast({
        title: markPaid ? 'Purchase paid' : 'Purchase saved',
        description: `${result.invoiceNumber} · ${formatMoney(result.total, { currency: 'USD' })} · ${markPaid ? 'cash + stock updated' : 'unpaid'}`,
      });
      setCart({});
      setCartOpen(false);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOcrPurchase = async (data: OcrPurchaseSave) => {
    if (!storeId || !user?.id) throw new Error('No store');
    const result = await createVPurchase({
      storeId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      supplierId: data.supplierId,
      notes: data.notes,
      markPaid: true,
      items: data.items.map((item) => ({
        materialId: item.materialId,
        materialName: item.materialName,
        sku: item.sku,
        unit: item.unit,
        unitCost: item.unitPrice,
        quantity: item.quantity,
      })),
    });
    toast({
      title: 'Purchase saved from scan',
      description: `${result.invoiceNumber} · ${formatMoney(result.total, { currency: 'USD' })}`,
    });
  };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-background px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" asChild>
            <Link to="/admin/dashboard" aria-label="Back to dashboard">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="h-11 pl-9 text-base"
              inputMode="search"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setOcrOpen(true)}
            aria-label="Scan receipt"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-2">
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={supplierOpen}
                className="h-11 w-full justify-between text-base font-normal"
              >
                <span className={cn('truncate', !selectedSupplierName && 'text-muted-foreground')}>
                  {selectedSupplierName || 'Select or type supplier…'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[210] w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search or new supplier name…"
                  value={supplierQuery}
                  onValueChange={setSupplierQuery}
                  className="h-11"
                />
                <CommandList className="max-h-56">
                  <CommandEmpty>
                    {supplierQuery.trim().length >= 2
                      ? 'No match — create below.'
                      : 'Type a supplier name.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredSuppliers.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.id}
                        onSelect={() => {
                          setSupplierId(s.id);
                          setSupplierOpen(false);
                          setSupplierQuery('');
                        }}
                        className="min-h-11 text-base"
                      >
                        <span className="truncate">{s.name}</span>
                        {supplierId === s.id ? (
                          <span className="ml-auto text-xs text-teal-600">Selected</span>
                        ) : null}
                      </CommandItem>
                    ))}
                    {canCreateSupplier ? (
                      <CommandItem
                        value={`__create__${supplierQuery}`}
                        onSelect={() => void handleCreateSupplierFromQuery()}
                        className="min-h-11 text-base text-teal-700"
                        disabled={creatingSupplier}
                      >
                        {creatingSupplier ? 'Creating…' : `Create “${supplierQuery.trim()}”`}
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 pb-40">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {search.trim().length >= 2 ? (
              <div className="space-y-3">
                <p>No material named “{search.trim()}”.</p>
                <Button
                  type="button"
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={creatingMaterial}
                  onClick={() => void handleCreateMaterialFromSearch()}
                >
                  {creatingMaterial ? 'Creating…' : `Add “${search.trim()}” to cart`}
                </Button>
              </div>
            ) : (
              'Search or type a material name to add a purchase line.'
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {canCreateMaterial ? (
              <button
                type="button"
                onClick={() => void handleCreateMaterialFromSearch()}
                disabled={creatingMaterial}
                className="w-full rounded-2xl border border-dashed border-teal-500/50 bg-teal-500/5 px-3 py-3 text-left text-sm font-medium text-teal-800"
              >
                {creatingMaterial ? 'Creating…' : `+ Add new material “${search.trim()}”`}
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((material) => {
              const qty = cart[material.id]?.quantity || 0;
              const tapped = lastTapId === material.id;
              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => addMaterial(material)}
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
                  <span className="block pr-6 text-sm font-semibold leading-snug line-clamp-3">{material.name}</span>
                  <span className="mt-2 block text-base font-bold tabular-nums text-teal-700">
                    {formatMoney(material.costPerUnit, { currency: 'USD' })}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/{material.unit || 'u'}</span>
                  </span>
                </button>
              );
            })}
            </div>
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
            {!supplierId && !supplierQuery.trim() ? (
              <span className="text-amber-600">· pick supplier</span>
            ) : null}
          </span>
          <span className="text-lg font-bold tabular-nums">{formatMoney(cartTotal, { currency: 'USD' })}</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={cartCount === 0 || (!supplierId && !supplierQuery.trim()) || submitting}
            onClick={() => void submit(false)}
          >
            Save unpaid
          </Button>
          <Button
            type="button"
            className="h-12 bg-teal-600 text-base hover:bg-teal-700"
            disabled={cartCount === 0 || (!supplierId && !supplierQuery.trim()) || submitting}
            onClick={() => void submit(true)}
          >
            Cash · {formatMoney(cartTotal, { currency: 'USD' })}
          </Button>
        </div>
      </div>

      {cartOpen ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => setCartOpen(false)}>
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h2 className="flex-1 text-center text-base font-semibold">Purchase cart</h2>
            <Button type="button" variant="ghost" size="sm" onClick={clearCart} disabled={cartCount === 0}>
              Clear
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <ul className="space-y-3">
              {cartLines.map((line) => (
                <li key={line.materialId} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{line.materialName}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Unit $</span>
                        <Input
                          className="h-9 w-24 text-base"
                          inputMode="decimal"
                          value={String(line.unitCost)}
                          onChange={(e) => setLineCost(line.materialId, Number(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => changeQty(line.materialId, -line.quantity)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeQty(line.materialId, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-8 text-center text-lg font-semibold tabular-nums">{line.quantity}</span>
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeQty(line.materialId, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-base font-bold tabular-nums">
                      {formatMoney(line.unitCost * line.quantity, { currency: 'USD' })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                disabled={cartCount === 0 || (!supplierId && !supplierQuery.trim()) || submitting}
                onClick={() => void submit(false)}
              >
                Save unpaid
              </Button>
              <Button
                type="button"
                className="h-12 bg-teal-600 hover:bg-teal-700"
                disabled={cartCount === 0 || (!supplierId && !supplierQuery.trim()) || submitting}
                onClick={() => void submit(true)}
              >
                Cash · {formatMoney(cartTotal, { currency: 'USD' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {ocrOpen ? (
        <Suspense fallback={null}>
          <OcrReceiptFlow
            open={ocrOpen}
            onOpenChange={setOcrOpen}
            storeId={storeId}
            allowedDestinations={['purchase']}
            suppliers={suppliers}
            materials={materials}
            onEnsureSupplier={async (name) => {
              const created = await ensureOcrSupplier({
                storeId,
                name,
                existing: suppliers,
              });
              if (!suppliers.some((s) => s.id === created.id)) {
                const next = [...suppliers, created];
                setSuppliers(next);
                vOpsCacheSet(vOpsCacheKey('suppliers', storeId), next);
              }
              return created;
            }}
            onEnsureMaterial={async (name, unitCost) => {
              const created = await ensureOcrMaterial({
                storeId,
                name,
                unitCost,
                existing: materials,
                existingCount: materials.length,
                source: 'v-purchase-ocr',
              });
              const lite = {
                id: created.id,
                name: created.name,
                sku: created.sku || '',
                unit: created.unit || 'piece',
                costPerUnit: unitCost,
              };
              const next = [...materials, lite];
              setMaterials(next);
              vOpsCacheSet(vOpsCacheKey('materials', storeId), next);
              return created;
            }}
            onSavePurchase={handleOcrPurchase}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
