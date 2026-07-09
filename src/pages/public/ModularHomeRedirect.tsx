import { Navigate } from 'react-router-dom';

/** Sends `/` to the React modular home (same Firebase auth session). */
export default function ModularHomeRedirect() {
  return <Navigate to="/home" replace />;
}
