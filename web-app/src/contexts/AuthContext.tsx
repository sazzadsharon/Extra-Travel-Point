'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

interface User {
  id: number;
  phone: string;
  email?: string;
  fullName?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (phone: string, password: string, fullName?: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const storedToken = localStorage.getItem('etp_access_token');
    const storedUser = localStorage.getItem('etp_user');
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('etp_user');
      }
    }
    setIsLoading(false);
  }, []);

  // Set auth header on axios
  useEffect(() => {
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      localStorage.setItem('etp_access_token', accessToken);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('etp_access_token');
    }
  }, [accessToken]);

  const login = async (phone: string, password: string) => {
    try {
      const response = await axios.post(`${API_CONFIG.API_BASE_URL}/auth/login`, { phone, password });
      const { user: userData, tokens } = response.data;
      setUser(userData);
      setAccessToken(tokens.accessToken);
      localStorage.setItem('etp_user', JSON.stringify(userData));
      return { success: true };
    } catch (err: any) {
      const error = err.response?.data?.error || 'Login failed';
      return { success: false, error };
    }
  };

  const register = async (phone: string, password: string, fullName?: string, email?: string) => {
    try {
      const response = await axios.post(`${API_CONFIG.API_BASE_URL}/auth/register`, {
        phone,
        password,
        fullName,
        email,
        role: 'customer'
      });
      const { user: userData, tokens } = response.data;
      setUser(userData);
      setAccessToken(tokens.accessToken);
      localStorage.setItem('etp_user', JSON.stringify(userData));
      return { success: true };
    } catch (err: any) {
      const error = err.response?.data?.error || 'Registration failed';
      return { success: false, error };
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('etp_access_token');
    localStorage.removeItem('etp_user');
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
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
