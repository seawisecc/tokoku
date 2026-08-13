import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FinishRegistration } from '@/components/domain/FinishRegistration'
import { Icon } from '@/components/ui/icons'
import { getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Daftarkan Toko | TokoKu' }
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
export default async function DaftarTokoPage({
  searchParams,
}: {
  searchParams: Promise<{ konfirmasi?: string }>
}) {
  const { konfirmasi } = await searchParams
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
    /* `.auth-single` (430px), bukan `.auth-shell` (880px). Halaman ini cuma
       berisi dua isian dan dua tombol; di 880px kartunya merentang dua kali
       lebih lebar daripada isinya dan terbaca seperti tata letak yang belum
       jadi. Lebar yang sama dipakai semua halaman auth satu langkah — Masuk,
       Lupa Sandi, Atur Sandi, Undangan. */
    <div className="auth-single">
      <div className="auth-container">
        {/* Konfirmasi email berhasil. Tanpa penanda ini orang mendarat di
            halaman "Daftarkan Toko" begitu saja setelah menekan tautan di
            email, tanpa satu pun kalimat yang mengatakan konfirmasinya
            berhasil — dan tidak ada cara membedakannya dari tautan yang gagal. */}
        {konfirmasi === '1' && !existing && (
          <div className="empty-note is-ok" style={{ marginBottom: 16 }} role="status">
            <Icon name="check" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Email Anda sudah terkonfirmasi. Tinggal satu langkah lagi.
            </div>
          </div>
        )}
        <p className="auth-eyebrow">{existing ? 'Toko baru' : 'Satu langkah lagi'}</p>
        <h1 className="auth-title">Daftarkan Toko Anda</h1>
        <p className="auth-sub">
          {existing ? (
            <>
              Toko baru punya produk, tim, stok, dan langganannya <strong>sendiri</strong>, terpisah
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
              ? 'Anda sudah memiliki 5 toko. Itu batas per akun. Hubungi admin TokoKu kalau memang perlu lebih.'
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
