import { useLocation } from 'react-router-dom';
import { usePlayStoreV1Nav } from '@/hooks/usePlayStoreV1Nav';
import { isPlayStoreV1AllowedPath, normalizeAppPath } from '@/lib/playStoreNavScope';

type PlayStoreV1RouteGuardProps = {
  children: React.ReactNode;
};

/**
 * Play Store v1 — allow all core billing routes in the Android app.
 * Advanced modules (PSA, staff, inventory setup) stay web-only via sidebar trim, not hard blocks.
 */
const PlayStoreV1RouteGuard = ({ children }: PlayStoreV1RouteGuardProps) => {
  const { active } = usePlayStoreV1Nav();
  const { pathname } = useLocation();

  if (!active) return <>{children}</>;

  const path = normalizeAppPath(pathname);
  if (isPlayStoreV1AllowedPath(path)) return <>{children}</>;

  // Fallback: never hard-block in the Android shell — nav trim is enough
  return <>{children}</>;
};

export default PlayStoreV1RouteGuard;
