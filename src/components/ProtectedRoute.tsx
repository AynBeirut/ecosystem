
import React from "react";
import { useAuth } from '@/context/useAuth';
import { Navigate } from 'react-router-dom';


const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  // Wait for auth state to finish loading before making redirect decisions
  if (isLoading) {
    // Optionally, show a loading spinner or null
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
