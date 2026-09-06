import { Navigate, useParams } from 'react-router-dom';

/** Legacy /demoshop/* → /demo/* */
export default function DemoLegacyRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/#industries" replace />;
  return <Navigate to={`/demo/${slug}`} replace />;
}
