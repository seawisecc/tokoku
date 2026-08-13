import type { Metadata } from 'next'
import Link from 'next/link'
import { AcceptInvitation } from '@/components/domain/AcceptInvitation'
import { InvitationSignUp } from '@/components/domain/InvitationSignUp'
import { Icon } from '@/components/ui/icons'
import { getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Undangan | TokoKu' }
export const dynamic = 'force-dynamic'

const PERAN: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin Toko',
  cashier: 'Kasir',
}

type Preview = {
  status: string
  email: string | null
  role: string
  organization_name: string | null
  organization_city: string | null
}

export default async function UndanganPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  /**
   * Pratinjau diambil SEBELUM pemeriksaan login.
   *
   * `invitation_preview` memang di-grant ke `anon` (migrasi 0016) justru untuk
   * ini: yang membuka tautan berhak tahu toko mana dan peran apa yang
   * ditawarkan sebelum dia diminta membuat akun. Tokennya sendiri yang jadi
   * kuncinya, dan token itu hanya ada di email yang dituju.
   */
  const { data } = await supabase.rpc('invitation_preview', { p_token: token })
  const preview = data as Preview | null

  const problem =
    !preview || preview.status === 'invalid'
      ? 'Tautan undangan ini tidak dikenali. Minta pemilik toko mengirim ulang.'
      : preview.status === 'revoked'
        ? 'Undangan ini sudah dibatalkan oleh pemilik toko.'
        : preview.status === 'already_accepted'
          ? 'Undangan ini sudah pernah diterima.'
          : preview.status === 'expired'
            ? 'Undangan ini sudah kedaluwarsa. Minta pemilik toko mengirim yang baru.'
            : null

  const ctx = user ? await getSessionContext() : null

  /**
   * Lebarnya dikunci `.auth-single` (430px), sama dengan Lupa Kata Sandi.
   *
   * Sebelumnya memakai `.card` polos di dalam layout auth yang lebarnya 880px,
   * jadi kartunya merentang dua kali lebih lebar daripada isinya — satu
   * kalimat pendek dan dua tombol di atas bidang putih raksasa. Semua halaman
   * auth satu langkah memakai lebar yang sama.
   *
   * Blok brand sengaja TIDAK dirender di sini: `(auth)/layout.tsx` sudah
   * memasangnya. Sempat dipasang dua kali, dan yang kedua tampil sebagai logo
   * kembar dengan tulisan yang hilang.
   */
  if (problem) {
    return (
      <div className="auth-single">
        <div className="auth-container">
          <div className="empty-note" style={{ marginBottom: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{problem}</div>
          </div>
          <Link
            href={ctx ? '/' : '/masuk'}
            className="btn btn-ghost btn-block"
            style={{ textDecoration: 'none' }}
          >
            {ctx ? 'Kembali ke aplikasi' : 'Ke halaman masuk'}
          </Link>
        </div>
      </div>
    )
  }

  // Belum login. Dulu di sini cuma ada tombol "Masuk", dan itu buntu untuk
  // orang yang justru paling mungkin membuka tautan ini: yang belum punya akun.
  if (!user) {
    return (
      <div className="auth-single">
        <div className="auth-container">
          <InvitationSignUp
            token={token}
            email={preview!.email ?? ''}
            storeName={preview!.organization_name ?? 'toko ini'}
            roleLabel={PERAN[preview!.role] ?? preview!.role}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-single">
      <div className="auth-container">
        <p className="auth-eyebrow">Undangan</p>
        <h1 className="auth-title">Bergabung dengan {preview!.organization_name}</h1>
        <p className="auth-sub">
          Anda diundang sebagai{' '}
          <strong style={{ color: 'var(--color-ink)' }}>
            {PERAN[preview!.role] ?? preview!.role}
          </strong>
          {preview!.organization_city ? ` di ${preview!.organization_city}` : ''}. Anda masuk
          sebagai {user.email}.
        </p>

        {/* Undangan dikirim ke alamat lain daripada akun yang sedang dipakai.
            Tokennya tetap sah — `accept_invitation` sengaja mengandalkan token,
            bukan kecocokan email — tapi orangnya berhak tahu, karena hampir
            selalu ini berarti dia lupa sedang login sebagai siapa. */}
        {preview!.email &&
          user.email &&
          preview!.email.toLowerCase() !== user.email.toLowerCase() && (
            <div className="empty-note is-warn" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                Undangan ini dikirim ke {preview!.email}, sementara Anda masuk sebagai{' '}
                {user.email}. Kalau diterima sekarang, akun inilah yang bergabung.
              </div>
            </div>
          )}

        <AcceptInvitation token={token} />
      </div>
    </div>
  )
}
