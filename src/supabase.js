/**
 * Supabase client for authentication.
 *
 * Configured via Vite env vars (set in .env, see .env.example):
 *   VITE_SUPABASE_URL      — https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY — the public anon/publishable key
 *
 * When not configured (local dev without Supabase), `supabase` is null:
 * the app hides all login UI and runs in localStorage-only mode.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
