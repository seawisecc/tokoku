import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FinishRegistration } from '@/components/domain/FinishRegistration'
import { getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Daftarkan Toko — TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Halaman ini melayani DUA keadaan sekaligus.
 *
 * 1. Akun baru yang belum punya toko sama sekali — terjadi saat konfirmasi email
 *    menyala, karena `signUp` tidak mengembalikan sesi sehingga tokonya belum
 *    bisa dibuat di langkah itu.
 * 2. Akun yang SUDAH punya toko dan ingin menambah satu lagi.
 *
 * Dulu keadaan kedua langsung dialihkan ke beranda ("sudah punya toko, tidak
 * ada yang perlu diselesaikan"). Sejak satu akun boleh punya beberapa toko,
 * pengalihan itu justru menutup satu-satunya pintu untuk menambah.
 */
export default async function DaftarTokoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/masuk')

  const ctx = await getSessionContext()
  // Super Admin tidak punya toko dan tidak mendaftarkan toko.
  if (ctx?.role === 'platform_admin') redirect('/admin')

  const owned = ctx?.organizations.filter((o) => o.role === 'owner').length ?? 0
  const existing = ctx !== null
  const meta = (user.user_metadata ?? {}) as {
    pending_store_name?: string
    pending_store_city?: string
  }

  return (
    <div className="auth-shell">
      <div className="card" style={{ padding: 26 }}>
        <p className="auth-eyebrow">{existing ? 'Toko baru' : 'Satu langkah lagi'}</p>
        <h1 className="auth-title">Daftarkan Toko Anda</h1>
        <p className="auth-sub">
          {existing ? (
            <>
              Toko baru punya produk, tim, stok, dan langganannya <strong>sendiri</strong> — terpisah
              penuh dari toko Anda yang sekarang. Kalau yang Anda maksud adalah membuka cabang
              dengan katalog yang sama, gunakan Pengaturan → Outlet.
            </>
          ) : (
            <>Akun {user.email} sudah aktif. Beri nama toko Anda untuk mulai memakai TokoKu.</>
          )}
        </p>

        <FinishRegistration
          defaultName={existing ? '' : (meta.pending_store_name ?? '')}
          defaultCity={existing ? '' : (meta.pending_store_city ?? '')}
          submitLabel={existing ? 'Buat Toko Baru' : 'Selesaikan Pendaftaran'}
          showSignOut={!existing}
        />

        {existing && (
          <p className="field-hint" style={{ marginTop: 14 }}>
            {owned >= 5
              ? 'Anda sudah memiliki 5 toko — itu batas per akun. Hubungi admin TokoKu kalau memang perlu lebih.'
              : `Toko yang Anda miliki: ${owned} dari 5.`}{' '}
            <Link href="/beranda" className="link">
              Kembali
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
