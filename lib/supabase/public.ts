import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Klien Supabase untuk halaman PUBLIK yang boleh di-cache.
 *
 * Bedanya dengan `lib/supabase/server.ts` cuma satu: klien ini TIDAK menyentuh
 * cookie sama sekali. Itu yang menentukan segalanya di Next 16 — memanggil
 * `cookies()` menandai seluruh rute sebagai dinamis, dan `export const
 * revalidate` yang sudah ditulis di halamannya ikut tidak berlaku tanpa satu
 * pun peringatan.
 *
 * Sudah menggigit di `/fitur`: halamannya sudah menulis `revalidate = 300`
 * berbulan-bulan, tapi tetap dirender ulang setiap permintaan karena memakai
 * klien ber-cookie. Terukur 503 ms dari Bali, sementara halaman legal yang
 * benar-benar statis dilayani dari cache tepi. Itu halaman tempat calon klien
 * membandingkan paket, jadi ia justru yang paling tidak boleh lambat.
 *
 * HANYA untuk data yang memang boleh dilihat siapa saja (daftar paket).
 * Tanpa cookie berarti tanpa sesi, jadi RLS memperlakukan pemanggilnya sebagai
 * `anon` — dan itu memang yang diinginkan. Jangan sekali-kali dipakai untuk
 * data tenant.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
