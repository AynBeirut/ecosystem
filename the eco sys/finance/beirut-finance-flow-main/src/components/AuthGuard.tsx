import { Navigate, useLocation } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isLoggedIn, user } = useAppContext();
  const location = useLocation();

  console.log("[AuthGuard] Checking auth - isLoggedIn:", isLoggedIn, "user:", !!user);

  if (!isLoggedIn || !user) {
    console.log("[AuthGuard] Not authenticated, redirecting to /");
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
