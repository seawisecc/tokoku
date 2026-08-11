import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryManager, type CategoryRow } from '@/components/domain/CategoryManager'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kategori | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function KategoriPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()

  const [{ data: cats }, { data: products }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color_key')
      .eq('organization_id', session.org!.id)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('products')
      .select('category_id')
      .eq('organization_id', session.org!.id)
      .is('deleted_at', null),
  ])

  const counts = new Map<string, number>()
  for (const p of products ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  }

  const rows: CategoryRow[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    colorKey: c.color_key ?? 'default',
    productCount: counts.get(c.id) ?? 0,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Kategori Produk"
        subtitle="Warna kategori dipakai di kartu produk layar Kasir."
      />
      <CategoryManager categories={rows} />
    </>
  )
}
