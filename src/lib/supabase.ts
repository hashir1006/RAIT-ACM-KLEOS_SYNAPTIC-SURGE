/**
 * PHASE 2: SUPABASE CLIENT CONFIGURATION
 * 
 * Security notes:
 * - ANON_KEY is safe for frontend (RLS enforces per-user access)
 * - SERVICE_ROLE_KEY is BACKEND ONLY — never expose to browser
 * - All sensitive writes happen through authenticated server APIs
 * 
 * Environment variable compatibility:
 * - Vite frontend uses import.meta.env.VITE_* 
 * - Node.js server uses process.env.*
 * - Both sets are present in .env
 */

import { createClient } from '@supabase/supabase-js';

// Support both Vite (import.meta.env) and Node.js (process.env)
const getEnv = (key: string): string => {
  // Vite exposes VITE_ prefixed vars via import.meta.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const viteEnv = (import.meta as any).env;
    // Try VITE_ prefix first, then NEXT_PUBLIC_ prefix
    return viteEnv[`VITE_${key}`] || viteEnv[`NEXT_PUBLIC_${key}`] || '';
  }
  // Node.js environment (server.ts)
  return process.env[`NEXT_PUBLIC_${key}`] || process.env[key] || '';
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

// ─── FRONTEND CLIENT ──────────────────────────────────────────────────────────
// Uses ANON_KEY + RLS policies to enforce per-user data isolation
export const supabasePublic = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, // We manage sessions via our own JWT
      autoRefreshToken: false
    }
  }
);

// ─── BACKEND / SERVER CLIENT ──────────────────────────────────────────────────
// Uses SERVICE_ROLE_KEY — bypasses RLS (only safe on backend)
// WARNING: Never bundle this into frontend code
export const supabaseServer = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Get Supabase client based on context
 * @param isServer - true for backend (service role), false for frontend (anon)
 */
export function getSupabaseClient(isServer: boolean = false) {
  if (isServer) {
    if (!supabaseServer) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY not configured. Set it in .env file.'
      );
    }
    return supabaseServer;
  }
  return supabasePublic;
}

/**
 * Test Supabase connection health
 */
export async function verifySupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabasePublic.auth.getSession();
    if (error) {
      console.warn('Supabase connection warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase connection failed:', err);
    return false;
  }
}

export type Database = any; // Will be replaced with Supabase generated types

export default supabasePublic;
