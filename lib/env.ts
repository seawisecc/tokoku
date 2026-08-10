/**
 * Pemeriksaan variabel lingkungan.
 *
 * Dibuat terpisah supaya aplikasi gagal dengan pesan yang jelas saat konfigurasi
 * kurang, bukan dengan "fetch failed" di tengah request yang sulit dilacak.
 */

type EnvCheck = {
  key: string
  value: string | undefined
  required: boolean
  hint: string
}

export const envChecks = (): EnvCheck[] => [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: true,
    hint: 'Dashboard Supabase → Project Settings → Data API → Project URL',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: true,
    hint: 'Project Settings → API Keys → anon / publishable',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    required: false,
    hint: 'Project Settings → API Keys → service_role (khusus server)',
  },
]

/** Dipakai client & server. Melempar error kalau kosong. */
export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL belum diisi di .env.local')
  return v
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local')
  return v
}

/** true kalau minimal URL + anon key sudah terisi. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
