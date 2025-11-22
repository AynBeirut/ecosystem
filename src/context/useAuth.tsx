import { useContext } from 'react';
import { AuthContext } from './AuthContextValue';
import type { AuthContextType } from './AuthContext';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext) as AuthContextType | undefined;
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
