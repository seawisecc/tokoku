import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanManager, type PlanRow } from '@/components/domain/PlanManager'
import { requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Paket | Super Admin' }
export const dynamic = 'force-dynamic'

export default async function PaketPage() {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const [{ data: plans }, { data: orgs }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, code, name, description, price_monthly, max_outlets, max_users, max_products, max_devices, is_active')
      .order('sort_order'),
    supabase.from('organizations').select('plan_id').is('deleted_at', null),
  ])

  const counts = new Map<string, number>()
  for (const o of orgs ?? []) {
    if (o.plan_id) counts.set(o.plan_id, (counts.get(o.plan_id) ?? 0) + 1)
  }

  const rows: PlanRow[] = (plans ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    priceMonthly: p.price_monthly,
    maxOutlets: p.max_outlets,
    maxUsers: p.max_users,
    maxProducts: p.max_products,
    maxDevices: p.max_devices,
    isActive: p.is_active,
    clientCount: counts.get(p.id) ?? 0,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Paket Langganan"
        subtitle="Harga dan batasan yang dipakai seluruh klien."
      />
      <PlanManager plans={rows} />
    </>
  )
}
