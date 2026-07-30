import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store } from '@/types/product';
import { MapPin, Star, Heart } from 'lucide-react';
import { getFirestore, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { pushDebugLog } from '@/lib/debugLogger';
import { cn } from '@/lib/utils';

interface StoreCardProps {
  store: Store;
}

const StoreCard: React.FC<StoreCardProps> = ({ store }) => {
  const [productCount, setProductCount] = useState<number>(0);
  const { user, followStore, unfollowStore } = useAuth();
  const isFollowing = !!user?.following?.includes(store.id);

  useEffect(() => {
    const fetchCount = async () => {
      const db = getFirestore();
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', store.id));
      const snapshot = await getCountFromServer(q);
      setProductCount(snapshot.data().count || 0);
    };
    void fetchCount();
  }, [store.id]);

  return (
    <Link to={`/${store.slug || store.id}`} className="group block h-full">
      <article className="marketplace-store-card flex h-full flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-center bg-gradient-to-b from-neutral-50 to-white px-6 pb-2 pt-8">
          <div className="relative">
            <img
              src={store.logo}
              alt={store.name}
              className="h-[72px] w-[72px] rounded-2xl object-cover ring-1 ring-black/[0.06] transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-3 text-center">
          <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">{store.name}</h3>
          {store.slogan ? (
            <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{store.slogan}</p>
          ) : null}

          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-neutral-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{store.location}</span>
          </div>

          {store.rating !== undefined && store.ratingCount ? (
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              <span className="font-medium text-neutral-800">{store.rating.toFixed(1)}</span>
              <span className="text-neutral-400">({store.ratingCount})</span>
            </div>
          ) : null}

          {store.description ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-neutral-600">{store.description}</p>
          ) : null}

          <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-4">
            <span className="text-xs font-medium text-teal-700">
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </span>
            <button
              type="button"
              aria-label={isFollowing ? 'Unfollow store' : 'Follow store'}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                isFollowing
                  ? 'border-red-200 bg-red-50 text-red-500'
                  : 'border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300 hover:text-neutral-600',
              )}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) {
                  alert('Please sign in to follow stores');
                  return;
                }
                try {
                  if (isFollowing) {
                    await unfollowStore(store.id);
                  } else {
                    await followStore(store.id);
                  }
                } catch (err) {
                  const maybeErr = err as { code?: string; name?: string; message?: string } | undefined;
                  const code = maybeErr?.code || maybeErr?.name || '';
                  const msg = maybeErr?.message || String(err);
                  console.error('Follow action failed', { storeId: store.id, err });
                  const full = code ? `${code}: ${msg}` : msg;
                  pushDebugLog('Follow failed', full, { storeId: store.id, err });
                  alert('Failed to update follow status: ' + full);
                }
              }}
            >
              <Heart className={cn('h-4 w-4', isFollowing && 'fill-current')} />
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default StoreCard;
