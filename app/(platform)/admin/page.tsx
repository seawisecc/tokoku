import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/ui/icons'
import { requirePlatformAdmin } from '@/lib/auth'
import { rupiah, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { ClientRow } from '@/components/domain/ClientRow'
import { quotaLines, isFull, isNear, isAlerting } from '@/components/domain/QuotaBars'

export const metadata: Metadata = { title: 'Dashboard | Super Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const [{ data: clients }, { data: quotas }] = await Promise.all([
    supabase
      .from('v_client_overview')
      .select('id, name, city, status, plan_code, plan_name, outlet_count, user_count, revenue_mtd, joined_at')
      .order('joined_at', { ascending: false }),
    supabase.from('v_client_quota').select('*'),
  ])

  const rows = clients ?? []

  // Klien yang sudah mentok tidak bisa menambah produk, orang, atau perangkat
  // kasir — dan mereka tidak selalu melapor. Dimunculkan di halaman depan
  // supaya ketahuan sebagai peluang upgrade, bukan sebagai keluhan nanti.
  const strained = (quotas ?? [])
    .map((q) => {
      const lines = quotaLines({
        maxOutlets: q.max_outlets,
        maxUsers: q.max_users,
        maxProducts: q.max_products,
        maxDevices: q.max_devices,
        usedOutlets: q.used_outlets ?? 0,
        usedUsers: q.used_users ?? 0,
        usedProducts: q.used_products ?? 0,
        usedDevices: q.used_devices ?? 0,
      })
      const client = rows.find((c) => c.id === q.organization_id)
      // Batas yang cuma menggambarkan bentuk paket (mis. Starter = 1 outlet)
      // tidak ikut — lihat isStructural() di QuotaBars.
      const alerting = lines.filter(isAlerting)
      return {
        client,
        full: alerting.filter(isFull),
        near: alerting.filter(isNear),
      }
    })
    .filter((x) => x.client && (x.full.length > 0 || x.near.length > 0))
  const byPlan = (code: string) => rows.filter((c) => c.plan_code === code).length
  const inactive = rows.filter((c) => c.status === 'inactive' || c.status === 'suspended').length
  const totalRevenue = rows.reduce((s, c) => s + Number(c.revenue_mtd ?? 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Ringkasan Platform"
        title="Dashboard Super Admin"
        subtitle="Pantau performa seluruh klien TokoKu dari satu tempat."
      />

      <div className="hero">
        <div className="hero-label">Omset Platform · Bulan Ini</div>
        <div className="hero-num">{rupiah(totalRevenue)}</div>
        <div className="hero-meta">
          <div><b>{rows.filter((c) => c.status === 'active').length}</b><span>Klien aktif</span></div>
          <div><b>{rows.reduce((s, c) => s + Number(c.outlet_count ?? 0), 0)}</b><span>Total outlet</span></div>
          <div><b>{rows.reduce((s, c) => s + Number(c.user_count ?? 0), 0)}</b><span>Total pengguna</span></div>
        </div>
      </div>

      <div className="grid grid-stats">
        <PlanStat bg="#EEF1EC" fg="#4B5A50" value={byPlan('starter')} label="Klien paket Starter" />
        <PlanStat bg="var(--color-success-soft)" fg="var(--color-success)" value={byPlan('growth')} label="Klien paket Growth" />
        <PlanStat bg="var(--color-forest)" fg="var(--color-mint)" value={byPlan('enterprise')} label="Klien paket Enterprise" />
        <PlanStat bg="var(--color-coral-soft)" fg="var(--color-coral)" value={inactive} label="Klien nonaktif" icon="alert" />
      </div>

      {strained.length > 0 && (
        <>
          <div className="section-title">Kuota Perlu Perhatian</div>
          <div className="table-card">
            <div className="table-scroll">
              <table>
                <tbody>
                  {strained.map(({ client, full, near }) => (
                    <tr key={client!.id}>
                      <td>
                        <Link href={`/admin/klien/${client!.id}`} className="cell-name">
                          {client!.name}
                        </Link>
                        <div className="cell-sub">{client!.plan_name ?? 'Tanpa paket'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {full.map((l) => (
                            <span className="badge badge-low" key={l.label}>
                              {l.label} penuh · {l.used}/{l.limit}
                            </span>
                          ))}
                          {near.map((l) => (
                            <span className="badge badge-trial" key={l.label}>
                              {l.label} {l.used}/{l.limit}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="section-title">
        Klien Terbaru
        <Link href="/admin/klien" className="link">
          Lihat semua <Icon name="chevronRight" size={13} />
        </Link>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <tbody>
              {rows.slice(0, 5).map((c) => (
                <ClientRow key={c.id} client={c} joined={tanggal(c.joined_at)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function PlanStat({ bg, fg, value, label, icon = 'users' }: {
  bg: string; fg: string; value: number; label: string; icon?: 'users' | 'alert'
}) {
  return (
    <div className="card stat">
      <div className="stat-icon" style={{ background: bg, color: fg }}>
        <Icon name={icon} size={17} />
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
