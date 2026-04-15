import { createContext } from 'react';
import type { Language } from '../types';

type ToastType = 'success' | 'error' | 'info';

export const LanguageContext = createContext<{
  lang: Language;
  t: (key: string) => string;
}>({ lang: 'bn', t: (k) => k });

export const ToastContext = createContext<{
  notify: (msg: string, type?: ToastType) => void;
}>({ notify: () => {} });
