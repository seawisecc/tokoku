import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/layout/BrandMark'
import { AcceptInvitation } from '@/components/domain/AcceptInvitation'
import { Icon } from '@/components/ui/icons'
import { getSessionContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Undangan — TokoKu' }
export const dynamic = 'force-dynamic'

export default async function UndanganPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belum login: undangan tidak bisa ditukar tanpa identitas.
  if (!user) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <BrandMark context="by Seawise Studio" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Anda diundang bergabung</h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Masuk dulu dengan akun Anda, lalu buka kembali tautan undangan ini.
          </p>
          <Link href="/masuk" className="btn btn-primary btn-block">
            Masuk
          </Link>
        </div>
      </>
    )
  }

  // Lewat RPC, bukan SELECT langsung: penerima undangan belum jadi anggota
  // sehingga RLS organizations menolak dia membaca nama tokonya.
  const { data } = await supabase.rpc('invitation_preview', { p_token: token })
  const preview = data as {
    status: string
    role: string
    organization_name: string | null
    organization_city: string | null
  } | null

  const ctx = await getSessionContext()

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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <BrandMark context="by Seawise Studio" />
      </div>

      <div className="card" style={{ padding: 22 }}>
        {problem ? (
          <>
            <div className="empty-note" style={{ marginBottom: 16 }}>
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>{problem}</div>
            </div>
            <Link href={ctx ? '/' : '/masuk'} className="btn btn-ghost btn-block">
              {ctx ? 'Kembali ke aplikasi' : 'Ke halaman masuk'}
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>
              Bergabung dengan {preview!.organization_name}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '0 0 16px', lineHeight: 1.6 }}>
              Anda diundang sebagai{' '}
              <strong style={{ color: 'var(--color-ink)' }}>
                {preview!.role === 'owner' ? 'Pemilik' : preview!.role === 'admin' ? 'Admin Toko' : 'Kasir'}
              </strong>
              {preview!.organization_city ? ` di ${preview!.organization_city}` : ''}. Anda masuk
              sebagai {user.email}.
            </p>
            <AcceptInvitation token={token} />
          </>
        )}
      </div>
    </>
  )
}
