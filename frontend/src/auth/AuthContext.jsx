import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import { getAccessToken, setTokens, clearTokens } from './tokenStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAccessToken()));

  const login = useCallback(async (email, password) => {
    const result = await api.post('/auth/login', { email, password });
    setTokens(result.tokens);
    setIsAuthenticated(true);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
