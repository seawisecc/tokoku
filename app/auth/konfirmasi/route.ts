import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Titik pendaratan tautan dari email Supabase (reset kata sandi, konfirmasi).
 *
 * HARUS berupa Route Handler, bukan Server Component. Menukar kode jadi sesi
 * berarti menulis cookie, dan penulisan cookie dari Server Component diabaikan
 * diam-diam — lihat `catch` kosong di lib/supabase/server.ts. Ditaruh di page,
 * pertukarannya seolah berhasil tapi sesinya tidak pernah tersimpan, dan user
 * mendarat di halaman ganti sandi tanpa hak apa pun.
 *
 * Dua bentuk tautan didukung karena template email Supabase bisa memakai
 * salah satunya:
 * - `?code=…`        alur PKCE, dipakai @supabase/ssr secara bawaan
 * - `?token_hash=…&type=recovery`  template yang memakai `{{ .TokenHash }}`
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // `next` hanya boleh path internal — tanpa ini, tautan email bisa dipakai
  // mengarahkan orang ke situs lain sambil membawa nama TokoKu.
  const requested = searchParams.get('next') ?? '/atur-sandi'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/atur-sandi'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  // Tautan kedaluwarsa, sudah dipakai, atau dibuka di browser lain. Halaman
  // tujuan yang menjelaskan ini ke user — di sini cukup ditandai.
  return NextResponse.redirect(new URL(`${next}?tautan=gagal`, origin))
}
