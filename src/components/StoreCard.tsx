
import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from '@/types/product';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { getFirestore, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { pushDebugLog } from '@/lib/debugLogger';
import { Button } from '@/components/ui/button';
import { Heart, HeartCrack } from 'lucide-react';

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
    fetchCount();
  }, [store.id]);

  return (
    <Link to={`/store/${store.slug || store.id}`}>
      <Card className="h-full overflow-hidden card-hover">
        <div className="p-4 flex items-center justify-center bg-gray-50">
          <img 
            src={store.logo} 
            alt={store.name} 
            className="h-24 w-24 object-cover rounded-full border-4 border-white shadow-sm"
          />
        </div>
        <CardContent className="pt-4">
          <h3 className="font-semibold text-lg mb-1 text-center">{store.name}</h3>
          {store.slogan && (
            <p className="text-sm text-gray-500 text-center italic mb-2">"{store.slogan}"</p>
          )}
          <div className="flex items-center justify-center text-xs text-gray-500 mb-2">
            <MapPin size={14} className="mr-1" />
            {store.location}
          </div>
          <p className="text-sm text-gray-600 text-center line-clamp-2">
            {store.description}
          </p>
        </CardContent>
        <CardFooter className="pt-0 justify-between items-center">
          <div className="text-sm text-center text-market-primary">
            {productCount} Products
          </div>
          <div>
            <Button
              size="sm"
              variant={isFollowing ? 'ghost' : 'outline'}
              onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!user) {
                    // Let the header or caller handle login flow; simple toast
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
                    // Try to extract Firebase-style error properties if present
                    const maybeErr = err as { code?: string; name?: string; message?: string } | undefined;
                    const code = maybeErr?.code || maybeErr?.name || '';
                    const msg = maybeErr?.message || String(err);
                    console.error('Follow action failed', { storeId: store.id, err });
                    const full = code ? `${code}: ${msg}` : msg;
                    // Push to debug console so you always get a copy in-app
                    pushDebugLog('Follow failed', full, { storeId: store.id, err });
                    // Use a visible browser alert so users can copy the error when reporting
                    alert('Failed to update follow status: ' + full);
                  }
                }}
            >
              {isFollowing ? <Heart size={16} className="text-red-500" /> : <HeartCrack size={16} />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default StoreCard;
