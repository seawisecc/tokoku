import type { Metadata } from 'next'
import { signOut } from '@/app/(auth)/actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/ui/icons'
import { ShiftCard } from '@/components/domain/ShiftCard'
import { initialsOf, requireSession } from '@/lib/auth'
import { cn } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Profil — TokoKu' }
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin Toko',
  cashier: 'Kasir',
}

const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-enterprise',
  admin: 'badge-growth',
  cashier: 'badge-starter',
}

function accessSummary(role: string, perms: Record<string, boolean>): string {
  if (role === 'owner') return 'Akses penuh ke semua modul'
  const labels: [string, string][] = [
    ['pos', 'Kasir'],
    ['products', 'Produk & stok'],
    ['reports', 'Laporan'],
    ['settings', 'Pengaturan'],
  ]
  const granted = labels.filter(([k]) => perms[k]).map(([, l]) => l)
  return granted.length ? granted.join(', ') : 'Belum ada akses modul'
}

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ akses?: string }>
}) {
  const session = await requireSession()
  const { akses } = await searchParams
  const supabase = await createClient()
  const isCashier = session.role === 'cashier'

  // Shift yang sedang berjalan milik user ini
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, opened_at, opening_cash')
    .eq('organization_id', session.org!.id)
    .eq('user_id', session.userId)
    .eq('status', 'open')
    .maybeSingle()

  let shiftSummary = null
  if (shift) {
    const { data: sales } = await supabase
      .from('transactions')
      .select('total, payment_method')
      .eq('shift_id', shift.id)
      .eq('status', 'paid')
    shiftSummary = {
      id: shift.id,
      openedAt: shift.opened_at,
      openingCash: shift.opening_cash,
      trxCount: (sales ?? []).length,
      cashSales: (sales ?? [])
        .filter((t) => t.payment_method === 'cash')
        .reduce((sum, t) => sum + t.total, 0),
    }
  }

  const { data: team } = await supabase
    .from('organization_members')
    .select('id, role, permissions, profiles:user_id(full_name)')
    .eq('organization_id', session.org!.id)
    .eq('status', 'active')
    .order('role')

  return (
    <>
      <PageHeader eyebrow="Akun" title="Profil" />

      {akses === 'ditolak' && (
        <div className="empty-note" style={{ marginBottom: 16 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            Halaman itu di luar akses Anda. Minta pemilik toko menyesuaikan izin modul.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--color-forest)',
            color: 'var(--color-mint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {session.initials}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{session.fullName}</div>
          <div className="cell-sub">
            {ROLE_LABEL[session.role] ?? session.role} · {session.org!.name}
            {session.org!.city ? `, ${session.org!.city}` : ''}
          </div>
        </div>
      </div>

      {shiftSummary && (
        <div style={{ marginTop: 18 }}>
          <ShiftCard shift={shiftSummary} />
        </div>
      )}

      {!isCashier && (
        <>
          <div className="section-title">Tim &amp; Akses</div>
          <div className="card">
            {(team ?? []).map((m) => {
              const name = (m.profiles as { full_name: string } | null)?.full_name ?? 'Tanpa nama'
              return (
                <div className="team-row" key={m.id}>
                  <div className="team-avatar">{initialsOf(name)}</div>
                  <div className="team-info">
                    <b>{name}</b>
                    <span>
                      {accessSummary(m.role, (m.permissions ?? {}) as Record<string, boolean>)}
                    </span>
                  </div>
                  <span className={cn('badge', ROLE_BADGE[m.role] ?? 'badge-ok')}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <form action={signOut} style={{ marginTop: 20 }}>
        <button className="btn btn-ghost btn-block" type="submit">
          <Icon name="logout" size={15} /> Keluar
        </button>
      </form>

      <p
        style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
        }}
      >
        TokoKu · <strong>by Seawise Studio</strong>
      </p>
    </>
  )
}
