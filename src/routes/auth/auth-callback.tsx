
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.log('[AuthCallback] Component mounted, user:', user);
    
    // If user is already authenticated, redirect to home
    if (user) {
      console.log('[AuthCallback] User found, redirecting to home');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
      return;
    }
    
    // Otherwise wait a bit and redirect anyway
    const timer = setTimeout(() => {
      console.log('[AuthCallback] Timeout reached, redirecting to login');
      navigate('/login', { replace: true });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-market-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
