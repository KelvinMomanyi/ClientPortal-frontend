import { createContext, useContext } from 'react';

export type Client = {
  id: number;
  name: string;
  email: string;
};

export type AuthContextType = {
  token: string | null;
  client: Client | null;
  isAuthenticated: boolean;
  login: (token: string, client: Client) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
