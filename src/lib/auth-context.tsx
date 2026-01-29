'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import { getMe, login as apiLogin, register as apiRegister } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, primarySport: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { access_token } = await apiLogin(email, password);
    localStorage.setItem('token', access_token);
    const userData = await getMe();
    setUser(userData);
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, name: string, primarySport: string) => {
    const { access_token } = await apiRegister(email, password, name, primarySport);
    localStorage.setItem('token', access_token);
    const userData = await getMe();
    setUser(userData);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
