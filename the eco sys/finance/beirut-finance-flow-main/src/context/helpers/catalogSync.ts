import type { Client, LineItem, Product, Supplier } from '../AppContext';

export async function resolveClientId(
  clients: Client[],
  addClient: (client: Omit<Client, 'id'>) => Promise<string | null>,
  clientId: string | undefined,
  clientName: string | undefined,
): Promise<string> {
  if (clientId?.trim()) return clientId.trim();
  const name = clientName?.trim();
  if (!name) return '';

  const existing = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const created = await addClient({
    name,
    address: '',
    phone: '',
    email: '',
    taxId: '',
  });
  return created || '';
}

export async function resolveSupplierId(
  suppliers: Supplier[],
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<string | null>,
  supplierId: string | undefined,
  supplierName: string | undefined,
): Promise<string> {
  if (supplierId?.trim()) return supplierId.trim();
  const name = supplierName?.trim();
  if (!name) return '';

  const existing = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const created = await addSupplier({
    name,
    address: '',
    phone: '',
    email: '',
  });
  return created || '';
}

export async function syncLineItemsToCatalog(
  products: Product[],
  addProduct: (product: Omit<Product, 'id'>) => Promise<string | null>,
  items: LineItem[],
): Promise<LineItem[]> {
  const next: LineItem[] = [];

  for (const item of items) {
    const description = item.description?.trim();
    if (!description) {
      next.push(item);
      continue;
    }

    const linked = products.find((p) => p.id === item.id);
    if (linked) {
      next.push(item);
      continue;
    }

    const byName = products.find((p) => p.name.toLowerCase() === description.toLowerCase());
    if (byName) {
      next.push({ ...item, id: byName.id });
      continue;
    }

    const createdId = await addProduct({
      name: description,
      type: 'service',
      salePrice: item.unitPrice || 0,
      description: '',
    });
    next.push(createdId ? { ...item, id: createdId } : item);
  }

  return next;
}
