import React from 'react';
import { supabase } from '../lib/supabase';

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', fontFamily: 'sans-serif', background: '#f8fafc',
        }}>
          <div style={{
            textAlign: 'center', padding: '2rem', background: 'white',
            borderRadius: '12px', boxShadow: '0 2px 16px rgba(0,0,0,0.1)', maxWidth: '400px',
          }}>
            <h2 style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '1.25rem' }}>
              কিছু একটা ভুল হয়েছে
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
              {import.meta.env.DEV ? (this.state.error?.message ?? 'Unknown error') : 'একটি অপ্রত্যাশিত সমস্যা হয়েছে।'}
            </p>
            <button
              onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
              style={{
                background: '#2563eb', color: 'white', padding: '0.625rem 1.5rem',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '0.9rem',
              }}
            >
              রিলোড করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
