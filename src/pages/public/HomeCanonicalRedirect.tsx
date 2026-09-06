import { Navigate, useLocation } from 'react-router-dom';

/** Canonical home is `/` — legacy `/home` bookmarks must not loop on static home.html */
export default function HomeCanonicalRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', hash: location.hash, search: location.search }} replace />;
}
