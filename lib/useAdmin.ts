import { useState, useEffect } from 'react';
import { User } from '../types';

export function useAdmin(currentUser: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    setIsAdmin(currentUser.role === 'admin');
    setIsLoading(false);
  }, [currentUser]);

  const hasPermission = (_permission: string): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin';
  };

  return { isAdmin, isLoading, hasPermission };
}
