import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { AuthContext, type Client } from './authContextValue';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [client, setClient] = useState<Client | null>(() => {
    try {
      const stored = localStorage.getItem('client');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((newToken: string, newClient: Client) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('client', JSON.stringify(newClient));
    setToken(newToken);
    setClient(newClient);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('client');
    setToken(null);
    setClient(null);
  }, []);

  // Listen for logout events from the API interceptor (e.g. on 401)
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, client, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
