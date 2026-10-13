import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { getErrorMessage } from './api';
import type { User } from './types';
import { useErrorToast } from './useErrorToast';

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  const stored = localStorage.getItem('taskflow_user');
  if (!stored) return null;
  try {
    const user: unknown = JSON.parse(stored);
    if (user && typeof user === 'object' &&
      'id' in user && typeof user.id === 'string' &&
      'name' in user && typeof user.name === 'string' &&
      'email' in user && typeof user.email === 'string') {
      return user as User;
    }
  } catch {
    localStorage.removeItem('taskflow_user');
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useErrorToast(error);

  useEffect(() => {
    const token = localStorage.getItem('taskflow_token');
    if (!token) {
      setUser(null);
      localStorage.removeItem('taskflow_user');
      setIsInitializing(false);
      return;
    }

    let active = true;
    api.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user as User);
        localStorage.setItem('taskflow_user', JSON.stringify(data.user));
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
          setUser(null);
          localStorage.removeItem('taskflow_token');
          localStorage.removeItem('taskflow_user');
          return;
        }
        if (!localStorage.getItem('taskflow_user')) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => { active = false; };
  }, []);

  const saveSession = (data: { token: string; user: User }) => {
    setUser(data.user);
    setIsInitializing(false);
    setError('');
    localStorage.setItem('taskflow_token', data.token);
    localStorage.setItem('taskflow_user', JSON.stringify(data.user));
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isInitializing,
    async signIn(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      saveSession(data);
    },
    async signUp(name, email, password) {
      const { data } = await api.post('/auth/register', { name, email, password });
      saveSession(data);
    },
    signOut() {
      setUser(null);
      localStorage.removeItem('taskflow_token');
      localStorage.removeItem('taskflow_user');
      navigate('/login');
    },
    updateUser(nextUser) {
      setUser(nextUser);
      localStorage.setItem('taskflow_user', JSON.stringify(nextUser));
    }
  }), [user, isInitializing, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
