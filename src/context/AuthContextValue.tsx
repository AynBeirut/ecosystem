import { createContext } from 'react';
import type { AuthContextType } from './AuthContext';

// Lightweight typed context container. The concrete AuthProvider fills this.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
