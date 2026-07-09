import React, { useCallback, useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { ProductReview, ProductReviewStatus } from '@/types/product';
import { applyReviewAggregateTransition } from '@/lib/productReviews';

type ProductReviewRow = ProductReview & {
  id: string;
  productName?: string;
};

const AdminProductReviews: React.FC = () => {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProductReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setStoreId(getActualStoreId(user));
    }
  }, [user]);

  const loadReviews = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const db = getFirestore();
      const reviewsQuery = query(
        collection(db, 'productReviews'),
        where('storeId', '==', storeId)
      );
      const reviewsSnap = await getDocs(reviewsQuery);
      const productIds = [...new Set(reviewsSnap.docs.map((d) => String((d.data() as any).productId || '')).filter(Boolean))];

      const productNameMap: Record<string, string> = {};
      await Promise.all(productIds.map(async (productId) => {
        try {
          const productSnap = await getDoc(doc(db, 'products', productId));
          if (productSnap.exists()) {
            const p = productSnap.data() as any;
            productNameMap[productId] = String(p.name || 'Unnamed Product');
          }
        } catch {
          productNameMap[productId] = 'Unknown Product';
        }
      }));

      const rows = reviewsSnap.docs.map((d) => {
        const data = d.data() as ProductReview;
        return {
          id: d.id,
          ...data,
          productName: productNameMap[data.productId] || 'Unknown Product',
        } as ProductReviewRow;
      });

      rows.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
      });

      setReviews(rows);
    } catch (err) {
      console.error('Failed to load product reviews', err);
      toast.error('Failed to load product reviews');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const moderateReview = async (reviewId: string, targetStatus: ProductReviewStatus) => {
    if (!storeId || !user?.id) return;
    setProcessingId(reviewId);
    try {
      const db = getFirestore();
      const reviewRef = doc(db, 'productReviews', reviewId);

      await runTransaction(db, async (tx) => {
        const reviewSnap = await tx.get(reviewRef);
        if (!reviewSnap.exists()) throw new Error('Review not found');

        const review = reviewSnap.data() as ProductReview;
        const previousStatus = review.status;

        tx.update(reviewRef, {
          status: targetStatus,
          moderatedBy: user.id,
          moderatedAt: serverTimestamp(),
        });

        if (!review.productId) return;
        const productRef = doc(db, 'products', review.productId);
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists()) return;

        const product = productSnap.data() as any;
        const prevCount = Number(product.ratingCount || 0);
        const prevAvg = Number(product.rating || 0);
        const rating = Number(review.rating || 0);

        const applyApprove = previousStatus !== 'approved' && targetStatus === 'approved';
        const applyRemove = previousStatus === 'approved' && targetStatus !== 'approved';

        if (applyApprove) {
          const next = applyReviewAggregateTransition({
            previousAverage: prevAvg,
            previousCount: prevCount,
            rating,
            transition: 'approve',
          });
          tx.update(productRef, next);
        } else if (applyRemove) {
          const next = applyReviewAggregateTransition({
            previousAverage: prevAvg,
            previousCount: prevCount,
            rating,
            transition: 'remove',
          });
          tx.update(productRef, next);
        }
      });

      toast.success(`Review ${targetStatus}`);
      loadReviews();
    } catch (err) {
      console.error('Failed to moderate review', err);
      toast.error('Failed to update review status');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminPageShell
      title="Product Reviews"
      description="Approve or reject customer reviews. Only approved reviews count in product ratings."
      eyebrow="Commerce"
      backTo="/admin/dashboard"
    >
        <AdminPanel>
          <CardHeader>
            <CardTitle>Product Reviews Moderation</CardTitle>
            <CardDescription>Approve or reject customer reviews. Only approved reviews count in product ratings.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-sm text-gray-500">No product reviews found yet.</div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{review.productName}</div>
                        <div className="text-sm text-gray-500">by {review.userName || review.userId}</div>
                        <div className="text-sm text-amber-600">{'★'.repeat(Math.round(review.rating || 0)).padEnd(5, '☆')} {Number(review.rating || 0).toFixed(1)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={review.status === 'approved' ? 'default' : review.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {review.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === review.id || review.status === 'approved'}
                          onClick={() => moderateReview(review.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={processingId === review.id || review.status === 'rejected'}
                          onClick={() => moderateReview(review.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                    {review.comment && (
                      <div className="mt-3 text-sm text-gray-700 border-t pt-3">{review.comment}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminProductReviews;
