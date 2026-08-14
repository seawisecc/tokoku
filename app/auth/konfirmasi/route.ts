import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type Klien = Awaited<ReturnType<typeof createClient>>

/** `/undangan/<token>` dan tidak lebih dari itu. */
const UNDANGAN = /^\/undangan\/([^/?#]+)$/

/**
 * Kalau tautan konfirmasi ini datang dari pendaftaran lewat undangan,
 * undangannya diterima DI SINI, bukan di halaman berikutnya.
 *
 * Dilaporkan klien 14 Agustus: kasir yang diundang menekan tautan undangan,
 * mengisi borang, menerima email konfirmasi, menekannya, lalu "malah diberikan
 * lagi link undangan". Yang dilihatnya memang halaman undangan lagi, dengan
 * satu tombol Terima Undangan. Secara teknis benar, tapi bagi orang yang baru
 * saja menekan "Buat Akun & Gabung" lalu mengonfirmasi emailnya, langkah
 * ketiga itu terbaca seperti berputar-putar di tempat yang sama — dan orang
 * yang mengira dirinya berputar akan berhenti.
 *
 * Persetujuannya sudah diberikan dua kali sebelum sampai ke sini: menekan
 * "Buat Akun & Gabung", lalu membuktikan alamat emailnya sendiri. Tidak ada
 * pertanyaan baru yang perlu ditanyakan di tombol ketiga.
 *
 * Gagal menerima (undangan kedaluwarsa, sudah dibatalkan, sudah dipakai) TIDAK
 * dianggap error di sini: user tetap diantar ke halaman undangan, dan halaman
 * itu yang menjelaskan keadaannya dengan kalimat lengkap.
 */
async function tujuanSetelahKonfirmasi(supabase: Klien, next: string): Promise<string> {
  const cocok = UNDANGAN.exec(next)
  if (!cocok) return next

  const { data, error } = await supabase.rpc('accept_invitation', { p_token: cocok[1] })
  if (error) return next

  return (data as { status?: string } | null)?.status === 'accepted' ? '/' : next
}

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
    if (!error) {
      return NextResponse.redirect(new URL(await tujuanSetelahKonfirmasi(supabase, next), origin))
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(await tujuanSetelahKonfirmasi(supabase, next), origin))
    }
  }

  // Tautan kedaluwarsa, sudah dipakai, atau dibuka di browser lain. Halaman
  // tujuan yang menjelaskan ini ke user — di sini cukup ditandai.
  return NextResponse.redirect(new URL(`${next}?tautan=gagal`, origin))
}
