import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { generateSlug } from '@/lib/slugify';
import type { Product } from '@/types/product';

function formatProductWriteError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') {
    return 'Could not save product — check that your subscription is active and you are signed in as the store owner.';
  }
  if (code === 'unauthenticated') {
    return 'Session expired — sign in again, then return to Store Builder to continue.';
  }
  return err instanceof Error ? err.message : 'Failed to save product';
}

/** Same root `products/` collection as AdminProducts — single source of truth. */
export async function listStoreProducts(storeId: string): Promise<Product[]> {
  if (!auth.currentUser) {
    throw new Error('Session expired — sign in again to load products.');
  }
  try {
    const snap = await getDocs(query(collection(getFirestore(), 'products'), where('storeId', '==', storeId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  } catch (err) {
    throw new Error(formatProductWriteError(err));
  }
}

export async function createSimpleStoreProduct(
  storeId: string,
  input: { name: string; price: number; description?: string; category?: string },
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Product name is required');
  if (!auth.currentUser) {
    throw new Error('Session expired — sign in again, then return to Store Builder to continue.');
  }

  const productSlug = generateSlug(name);
  const timestamp = new Date().toISOString();

  try {
    const docRef = await addDoc(collection(getFirestore(), 'products'), {
    name,
    description: input.description?.trim() || '',
    price: Number(input.price) || 0,
    category: input.category?.trim() || 'General',
    image: `https://placehold.co/400x300/38B2AC/fff?text=${encodeURIComponent(name)}`,
    imageAlt: name,
    storeId,
    slug: productSlug,
    inStock: true,
    stock: 0,
    deliveryTime: '1-3 days',
    productType: 'simple',
    isService: false,
    rating: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

    return docRef.id;
  } catch (err) {
    throw new Error(formatProductWriteError(err));
  }
}

export async function deleteStoreProduct(productId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), 'products', productId));
}
