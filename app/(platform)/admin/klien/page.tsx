import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { requirePlatformAdmin } from '@/lib/auth'
import { tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { ClientRow } from '@/components/domain/ClientRow'

export const metadata: Metadata = { title: 'Manajemen Klien | Super Admin' }
export const dynamic = 'force-dynamic'

export default async function KlienPage() {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const [{ data: clients }, { data: quotas }] = await Promise.all([
    supabase
      .from('v_client_overview')
      .select('id, name, city, status, plan_code, plan_name, outlet_count, user_count, product_count, revenue_mtd, joined_at')
      .order('joined_at', { ascending: false }),
    supabase.from('v_client_quota').select('*'),
  ])

  const quotaById = new Map(
    (quotas ?? []).map((q) => [
      q.organization_id,
      {
        maxOutlets: q.max_outlets,
        maxUsers: q.max_users,
        maxProducts: q.max_products,
        maxDevices: q.max_devices,
        usedOutlets: q.used_outlets ?? 0,
        usedUsers: q.used_users ?? 0,
        usedProducts: q.used_products ?? 0,
        usedDevices: q.used_devices ?? 0,
      },
    ]),
  )

  return (
    <>
      <PageHeader
        eyebrow="Master Data"
        title="Manajemen Klien"
        subtitle="Semua usaha UMKM yang berlangganan TokoKu."
      />

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {clients?.length ?? 0} klien terdaftar
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usaha</th><th>Paket</th><th>Outlet</th><th>User</th><th>Kuota Terketat</th><th>Status</th><th>Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  joined={tanggal(c.joined_at)}
                  full
                  quota={quotaById.get(c.id!) ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
