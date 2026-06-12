/**
 * useAuth.ts — Auth state, login, logout, session management.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import {
  signIn, signOut, onAuthStateChange, loadCurrentUserProfile,
} from '../db';

type ToastType = 'success' | 'error' | 'info';

interface UseAuthDeps {
  notify: (msg: string, type?: ToastType) => void;
}

interface UseAuthReturn {
  currentUser: User | null;
  isAuthChecked: boolean;
  loginEmail: string;
  loginPass: string;
  setLoginEmail: React.Dispatch<React.SetStateAction<string>>;
  setLoginPass: React.Dispatch<React.SetStateAction<string>>;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

export function useAuth({ notify }: UseAuthDeps): UseAuthReturn {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Supabase Auth + Profile Loading
  useEffect(() => {
    let dataLoadStarted = false;

    async function tryLoadUser(userId: string) {
      try {
        const profile = await loadCurrentUserProfile(userId);
        if (profile) {
          setCurrentUser(profile);
        }
      } catch (e) {
        console.error('Auth profile load error:', e);
      } finally {
        setIsAuthChecked(true);
      }
    }

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          setTimeout(() => tryLoadUser(session.user.id), 0);
        } else {
          setIsAuthChecked(true);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setTimeout(() => tryLoadUser(session.user.id), 0);
        } else {
          setIsAuthChecked(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        dataLoadStarted = false;
        setIsAuthChecked(true);
      } else {
        setIsAuthChecked(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      dataLoadStarted = false;
    };
  }, []);

  const handleLogin = useCallback(async () => {
    const { error } = await signIn(loginEmail, loginPass);
    if (error) {
      notify('ইমেইল বা পাসওয়ার্ড ভুল!', 'error');
    } else {
      setLoginEmail('');
      setLoginPass('');
    }
  }, [loginEmail, loginPass, notify]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setCurrentUser(null);
  }, []);

  return {
    currentUser,
    isAuthChecked,
    loginEmail,
    loginPass,
    setLoginEmail,
    setLoginPass,
    handleLogin,
    handleLogout,
  };
}
