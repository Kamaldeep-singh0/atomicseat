'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('atomic_seat_token');
    const savedUser = localStorage.getItem('atomic_seat_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('atomic_seat_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.data) {
      const { user: loggedInUser, token: authToken } = res.data;
      setUser(loggedInUser);
      setToken(authToken);
      localStorage.setItem('atomic_seat_token', authToken);
      localStorage.setItem('atomic_seat_user', JSON.stringify(loggedInUser));
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const res: any = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    if (res.success && res.data) {
      const { user: registeredUser, token: authToken } = res.data;
      setUser(registeredUser);
      setToken(authToken);
      localStorage.setItem('atomic_seat_token', authToken);
      localStorage.setItem('atomic_seat_user', JSON.stringify(registeredUser));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('atomic_seat_token');
    localStorage.removeItem('atomic_seat_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
