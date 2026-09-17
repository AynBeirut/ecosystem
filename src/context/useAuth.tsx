import { useContext, useMemo } from 'react';
import { AuthContext } from './AuthContextValue';
import type { AuthContextType } from './AuthContext';
import { withFirebaseUid } from '@/lib/authActorId';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext) as AuthContextType | undefined;
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const user = useMemo(
    () => (context.user ? withFirebaseUid(context.user) : null),
    [context.user],
  );

  return useMemo(
    () => ({
      ...context,
      user,
    }),
    [context, user],
  );
};
