import { supabaseAnonKey } from '@/lib/env'

/**
 * Deteksi koneksi.
 *
 * `navigator.onLine` tidak bisa dipercaya sendirian: ia hanya melaporkan ada
 * tidaknya antarmuka jaringan, jadi bernilai true saat tersambung WiFi warung
 * yang modemnya mati. Karena itu status "online" hanya diakui kalau ping ke
 * Supabase benar-benar berhasil.
 *
 * Ping WAJIB membawa `apikey`: tanpa header itu semua endpoint Supabase membalas
 * 401, dan aplikasi akan mengira dirinya offline padahal jaringannya sehat.
 */
const PING_TIMEOUT_MS = 4000

export async function pingServer(url: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabaseAnonKey() },
      signal: controller.signal,
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
