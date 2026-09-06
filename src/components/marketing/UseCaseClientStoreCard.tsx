import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import StoreVisual from '@/components/StoreVisual';
import { getUseCaseClientStore } from '@/data/marketing/useCaseShowcases';
import { MARKETING_PACKAGE_BY_SLUG } from '@/data/marketing/packageRegistry';
import { buildStorePublicUrl } from '@/lib/storeUrls';
import { packageLandingPath } from '@/lib/marketingPackages';

type Props = {
  useCaseId: string;
};

const UseCaseClientStoreCard: React.FC<Props> = ({ useCaseId }) => {
  const client = getUseCaseClientStore(useCaseId);
  const [logo, setLogo] = useState<string | undefined>(client?.logoUrl);
  const [storeName, setStoreName] = useState(client?.storeName ?? '');

  useEffect(() => {
    if (!client || client.logoUrl) return;
    let cancelled = false;
    const load = async () => {
      const db = getFirestore();
      const snap = await getDocs(
        query(collection(db, 'storeProfiles'), where('slug', '==', client.storeSlug)),
      );
      if (cancelled || snap.empty) return;
      const data = snap.docs[0].data() as { name?: string; logo?: string };
      if (data.name) setStoreName(data.name);
      if (data.logo) setLogo(data.logo);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!client) return null;

  const pkg = MARKETING_PACKAGE_BY_SLUG[client.packageSlug];
  const storeHref = buildStorePublicUrl(client.storeSlug);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Real Grabio client</p>
      <a
        href={storeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-teal-200 hover:bg-white hover:shadow-md"
      >
        <StoreVisual
          name={storeName}
          logo={logo}
          variant="card"
          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-800">{storeName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {client.clientNote ?? 'Live business running on Grabio'}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
            Visit their store
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </a>
      {pkg && (
        <Link
          to={packageLandingPath(client.packageSlug)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-700"
        >
          How Grabio fits {pkg.label.toLowerCase()} businesses
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
};

export default UseCaseClientStoreCard;
