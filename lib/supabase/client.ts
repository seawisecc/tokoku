'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Klien Supabase untuk komponen client.
 * Selalu tunduk pada RLS — memakai anon key + sesi user yang sedang login.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
}
