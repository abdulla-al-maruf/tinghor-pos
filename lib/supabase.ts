import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  document.getElementById('root')!.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fee2e2;">
      <div style="text-align:center;padding:2rem;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <h2 style="color:#dc2626;margin-bottom:1rem">&#9888;&#65039; Configuration Error</h2>
        <p>Supabase environment variables not configured.</p>
        <p style="color:#6b7280;font-size:0.875rem;margin-top:0.5rem">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify environment variables.</p>
      </div>
    </div>
  `;
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
