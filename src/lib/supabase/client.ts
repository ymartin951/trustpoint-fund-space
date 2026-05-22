'use client';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

declare global {
  // eslint-disable-next-line no-var
  var __trustPointSupabaseClient:
    | ReturnType<typeof createClient<Database>>
    | undefined;
}

export const supabase =
  globalThis.__trustPointSupabaseClient ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'trustpoint-fund-space-auth',
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__trustPointSupabaseClient = supabase;
}