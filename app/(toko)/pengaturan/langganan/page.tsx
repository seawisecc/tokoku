import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuotaBars, type Quota } from '@/components/domain/QuotaBars'
import { WhatsAppButton } from '@/components/domain/WhatsAppButton'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn, rupiah, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { subscriptionState } from '@/lib/subscription'

export const metadata: Metadata = { title: 'Langganan — TokoKu' }
export const dynamic = 'force-dynamic'

/** Kalimat manusia untuk tiap jenis peristiwa langganan. */
const AKSI: Record<string, string> = {
  subscribe: 'Mulai berlangganan',
  upgrade: 'Naik paket',
  downgrade: 'Turun paket',
  renew: 'Perpanjangan',
  cancel: 'Langganan dihentikan',
  reactivate: 'Diaktifkan kembali',
}

const STATUS: Record<string, { label: string; badge: string }> = {
  active: { label: 'Aktif', badge: 'badge-active' },
  trial: { label: 'Masa coba gratis', badge: 'badge-trial' },
  suspended: { label: 'Ditangguhkan', badge: 'badge-low' },
  inactive: { label: 'Nonaktif', badge: 'badge-inactive' },
}

/** Selisih HARI KALENDER — orang menghitung tanggal, bukan durasi jam. */
function sisaHari(iso: string): number {
  const akhir = new Date(new Date(iso).toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  const kini = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  return Math.round((akhir - kini) / 864e5)
}

export default async function LanggananPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: org }, { data: quota }, { data: events }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, status, trial_ends_at, plans:plan_id(name, code, price_monthly)')
      .eq('id', orgId)
      .maybeSingle(),
    // `v_client_quota` menyaring sendiri berdasarkan keanggotaan pemanggil
    // (lihat migrasi 0020), jadi pemilik toko boleh membacanya tanpa tambahan
    // apa pun — dan angkanya PERSIS sama dengan yang dilihat Super Admin.
    supabase.from('v_client_quota').select('*').eq('organization_id', orgId).maybeSingle(),
    supabase
      .from('subscription_events')
      .select('id, action, amount, created_at, plan:plan_id(name), from_plan:from_plan_id(name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const plan = org?.plans as unknown as {
    name: string
    code: string
    price_monthly: number | null
  } | null

  const status = STATUS[org?.status ?? 'trial'] ?? STATUS.trial
  const state = subscriptionState(session.org)
  const trialEnds = org?.status === 'trial' ? (org.trial_ends_at ?? null) : null
  const sisa = trialEnds ? sisaHari(trialEnds) : null

  const kuota: Quota | null = quota
    ? {
        maxOutlets: quota.max_outlets,
        maxUsers: quota.max_users,
        maxProducts: quota.max_products,
        maxDevices: quota.max_devices,
        usedOutlets: quota.used_outlets ?? 0,
        usedUsers: quota.used_users ?? 0,
        usedProducts: quota.used_products ?? 0,
        usedDevices: quota.used_devices ?? 0,
      }
    : null

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Langganan"
        subtitle="Paket, masa aktif, dan pemakaian kuota toko ini."
      />

      {/* ── Paket aktif ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="sub-top">
          <div>
            <div className="sub-plan-label">Paket aktif</div>
            <div className="sub-plan-name">{plan?.name ?? 'Belum berpaket'}</div>
            <div className="sub-plan-price">
              {plan?.price_monthly
                ? `${rupiah(plan.price_monthly)} / bulan`
                : 'Belum ada tagihan untuk toko ini.'}
            </div>
          </div>
          <span className={cn('badge', status.badge)}>{status.label}</span>
        </div>

        {/* Sisa trial disebut dengan angka DAN tanggal. Angkanya yang menempel
            di kepala ("tinggal 5 hari"), tanggalnya yang dipakai merencanakan. */}
        {sisa !== null && (
          <div
            className="empty-note"
            style={
              state.kind === 'lapsed'
                ? { marginTop: 16 }
                : state.kind === 'ending'
                  ? {
                      marginTop: 16,
                      background: 'var(--color-amber-soft)',
                      color: 'var(--color-amber-ink)',
                    }
                  : {
                      marginTop: 16,
                      background: 'var(--color-success-soft)',
                      color: 'var(--color-success)',
                    }
            }
          >
            <Icon name={state.kind === 'ok' ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              {sisa > 0 ? (
                <>
                  Masa coba gratis tinggal <b>{sisa} hari</b>, sampai{' '}
                  <b>{tanggal(trialEnds!)}</b>. Setelah itu kasir tidak bisa mencatat penjualan
                  baru.
                </>
              ) : sisa === 0 ? (
                <>
                  Masa coba gratis berakhir <b>hari ini</b>. Hubungi admin TokoKu hari ini juga
                  supaya kasir tidak berhenti besok pagi.
                </>
              ) : (
                <>
                  Masa coba gratis sudah berakhir <b>{tanggal(trialEnds!)}</b>. Kasir tidak bisa
                  mencatat penjualan baru dan data baru tidak bisa ditambah — semua data lama
                  tetap aman dan bisa dilihat.
                </>
              )}
            </div>
          </div>
        )}

        {(org?.status === 'suspended' || org?.status === 'inactive') && (
          <div className="empty-note" style={{ marginTop: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Langganan toko ini sedang tidak aktif. Kasir tidak bisa mencatat penjualan baru.
              Semua data lama tetap aman. Hubungi admin TokoKu untuk mengaktifkan kembali.
            </div>
          </div>
        )}
      </div>

      {/* ── Kuota ─────────────────────────────────────────────────────────── */}
      <div className="section-title">Pemakaian Kuota</div>
      <div className="card">
        {kuota ? (
          <>
            <QuotaBars quota={kuota} structuralAsInfo />
            <div className="field-hint" style={{ marginTop: 14 }}>
              Batas ini ditegakkan di database, jadi berlaku juga untuk perangkat kasir yang
              mendaftar sendiri saat sinkronisasi. Naik paket kalau salah satunya sudah penuh.
            </div>
          </>
        ) : (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Toko ini belum terikat paket, jadi belum ada batas apa pun.
          </div>
        )}
      </div>

      {/* ── Hubungi admin ─────────────────────────────────────────────────── */}
      <div className="section-title">Butuh Ubah Paket?</div>
      <div className="card">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
          Naik paket, perpanjang, atau tanya tagihan — semuanya lewat admin TokoKu. Pesan
          WhatsApp-nya sudah terisi nama toko dan paket Anda, jadi tidak perlu menjelaskan dari
          awal.
        </p>
        <WhatsAppButton
          storeName={org?.name ?? session.org!.name}
          planName={plan?.name ?? null}
          status={status.label}
        />
      </div>

      {/* ── Riwayat ───────────────────────────────────────────────────────── */}
      <div className="section-title">Riwayat Langganan</div>
      <div className="table-card">
        {(events ?? []).length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada perubahan langganan yang tercatat.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <tbody>
                {(events ?? []).map((e) => {
                  const ke = (e.plan as unknown as { name: string } | null)?.name
                  const dari = (e.from_plan as unknown as { name: string } | null)?.name
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="cell-name">{AKSI[e.action] ?? e.action}</div>
                        <div className="cell-sub">
                          {dari && ke ? `${dari} → ${ke}` : (ke ?? '—')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {Number(e.amount ?? 0) > 0 ? rupiah(Number(e.amount)) : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--color-ink-faint)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tanggal(e.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
