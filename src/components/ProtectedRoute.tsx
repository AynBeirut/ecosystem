
import React from "react";
import { useAuth } from '@/context/useAuth';
import { Navigate } from 'react-router-dom';


const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles?: string[];
  requiredPermission?: string;
}> = ({ children, allowedRoles, requiredPermission }) => {
  const { user, isLoading } = useAuth();

  // Wait for auth state to finish loading before making redirect decisions
  if (isLoading) {
    // Optionally, show a loading spinner or null
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (allowedRoles) {
    // For admin routes, allow both 'admin' and sub-accounts with manager role
    if (allowedRoles.includes('admin')) {
      const hasAccess = 
        user.role === 'admin' || 
        (user.role === 'sub_account' && user.subAccountRole === 'manager');
      
      if (!hasAccess) {
        return <Navigate to="/" replace />;
      }
    } else if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  // Check permission-based access for sub-accounts
  if (requiredPermission && user.role === 'sub_account') {
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
