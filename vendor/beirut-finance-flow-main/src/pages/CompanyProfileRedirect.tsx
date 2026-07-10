import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { BRAND } from '@/lib/branding';
import { isPlayStoreV1Shell } from '@/lib/playStoreNavScope';

/** Company/contact settings live in Grabio Admin Profile — redirect out of IM (web only). */
export default function CompanyProfileRedirect() {
  const inPlayApp = isPlayStoreV1Shell();

  useEffect(() => {
    if (inPlayApp) return;
    window.location.replace(`${BRAND.ecosystemUrl}/admin/profile`);
  }, [inPlayApp]);

  if (inPlayApp) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <p>Store profile is managed in Grabio Admin.</p>
      <p>
        <a href={`${BRAND.ecosystemUrl}/admin/profile`} className="text-[#38B2AC] hover:underline">
          Open Admin Profile →
        </a>
      </p>
    </div>
  );
}
