import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

interface Props {
  hostname: string;
}

const CustomDomainStore: React.FC<Props> = ({ hostname }) => {
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const lookupDomain = async () => {
      try {
        const db = getFirestore();
        const q = query(
          collection(db, 'storeProfiles'),
          where('customDomain', '==', hostname)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setNotFound(true);
        } else {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          if (data.slug) {
            setStoreSlug(data.slug as string);
          } else {
            setStoreId(docSnap.id);
          }
        }
      } catch (err) {
        console.error('[CustomDomainStore] Firestore lookup failed', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    lookupDomain();
  }, [hostname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Store Not Found</h1>
        <p className="text-muted-foreground">
          No store is connected to <strong>{hostname}</strong>. Please check with the store owner.
        </p>
      </div>
    );
  }

  if (storeSlug) {
    return <Navigate to={`/${storeSlug}`} replace />;
  }

  if (storeId) {
    return <Navigate to={`/store/id/${storeId}`} replace />;
  }

  return null;
};

export default CustomDomainStore;
