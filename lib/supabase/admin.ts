import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseUrl } from '@/lib/env'

/**
 * Klien service_role — MELEWATI SELURUH RLS.
 *
 * Hanya untuk operasi yang memang harus lintas tenant:
 * provisioning organisasi baru, tugas terjadwal, webhook billing.
 * Jangan pernah dipakai untuk melayani request user biasa; di situ RLS
 * justru satu-satunya yang mencegah data satu toko bocor ke toko lain.
 *
 * Import 'server-only' di atas membuat build gagal kalau file ini
 * tidak sengaja ikut ter-bundle ke client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local')

  return createClient<Database>(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
