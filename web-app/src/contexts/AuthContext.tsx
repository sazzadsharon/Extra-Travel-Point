'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { api, onAuthChange } from '../lib/apiClient';
import { tokenStorage } from '../lib/tokenStorage';

interface User {
  id: number;
  phone: string;
  email?: string;
  fullName?: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (
    phone: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    phone: string,
    password: string,
    fullName?: string,
    email?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setSession: (user: User, token: string, refreshToken?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function extractTokens(payload: any): AuthTokens | null {
  if (!payload) return null;
  const tokens = payload.tokens ?? payload;
  const accessToken: string | undefined = tokens.accessToken ?? tokens.token;
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from centralized token storage. The canonical apiClient
    // request interceptor reads the access token from storage on every request,
    // so we only need to hydrate React state here (no manual header sync).
    const storedToken = tokenStorage.getAccessToken();
    const storedUser = tokenStorage.getUser<User>();
    if (storedToken) {
      setAccessToken(storedToken);
    }
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(() => {
      setAccessToken(null);
      setUser(null);
    });
    return unsubscribe;
  }, []);

  const handleAuthSuccess = useCallback((userData: User, tokens: AuthTokens) => {
    setUser(userData);
    setAccessToken(tokens.accessToken);
    tokenStorage.setAccessToken(tokens.accessToken);
    if (tokens.refreshToken) {
      tokenStorage.setRefreshToken(tokens.refreshToken);
    }
    tokenStorage.setUser(userData);
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      try {
        const response = await api.post('/auth/login', { phone, password });
        const tokens = extractTokens(response.data);
        const userData: User | undefined = response.data?.user;
        if (!tokens || !userData) {
          return { success: false, error: 'Invalid server response' };
        }
        handleAuthSuccess(userData, tokens);
        return { success: true };
      } catch (err: any) {
        const error = err.response?.data?.error || 'Login failed';
        return { success: false, error };
      }
    },
    [handleAuthSuccess]
  );

  const register = useCallback(
    async (
      phone: string,
      password: string,
      fullName?: string,
      email?: string
    ) => {
      try {
        const response = await api.post('/auth/register', {
          phone,
          password,
          fullName,
          email,
          role: 'customer',
        });
        const tokens = extractTokens(response.data);
        const userData: User | undefined = response.data?.user;
        if (!tokens || !userData) {
          return { success: false, error: 'Invalid server response' };
        }
        handleAuthSuccess(userData, tokens);
        return { success: true };
      } catch (err: any) {
        const error = err.response?.data?.error || 'Registration failed';
        return { success: false, error };
      }
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(() => {
    // Best-effort server-side logout: clears the HttpOnly refresh-token cookie
    // on the backend. Client state is cleared unconditionally so logout always
    // completes even when the network/backend is unavailable.
    api.post('/auth/logout').catch(() => {
      /* ignore — client-side cleanup is authoritative */
    });
    tokenStorage.clear();
    setUser(null);
    setAccessToken(null);
  }, []);

  const setSession = useCallback(
    (u: User, token: string, refreshToken?: string) => {
      handleAuthSuccess(u, { accessToken: token, refreshToken });
    },
    [handleAuthSuccess]
  );

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, login, register, logout, setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
