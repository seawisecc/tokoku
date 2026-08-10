import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Klien Supabase untuk Server Component, Server Action, dan Route Handler.
 * Tetap tunduk pada RLS. Harus dibuat ulang tiap request — jangan disimpan
 * di variabel modul, karena cookie sesi berbeda per user.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Dipanggil dari Server Component, di mana cookie tidak bisa ditulis.
          // Aman diabaikan: middleware yang menyegarkan sesi.
        }
      },
    },
  })
}
