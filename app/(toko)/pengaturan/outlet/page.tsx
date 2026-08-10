import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { OutletManager } from '@/components/domain/OutletManager'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Outlet — TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Pengelolaan outlet.
 *
 * Tidak dikunci paket. `max_outlets` sudah ditegakkan di database dan itu SATU
 * sumber kebenarannya — menambah gerbang kedua di sini hanya menciptakan dua
 * aturan yang bisa berbeda. (`plans.features->>'multi_outlet'` sengaja tidak
 * dipakai: ia bisa berkata "boleh" sementara kuotanya berkata "penuh".)
 *
 * Toko paket Starter tetap melihat halaman ini — ia punya satu outlet dan berhak
 * mengubah namanya, alamatnya, dan melihat bahwa cabang kedua itu ada tapi
 * butuh paket lebih tinggi.
 */
export default async function PengaturanOutletPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: outlets }, { data: org }, { data: products }] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, code, address, phone, is_primary, is_active')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('name'),
    supabase.from('organizations').select('plans(max_outlets)').eq('id', orgId).maybeSingle(),
    // Stok di outlet AKTIF — sumber angka untuk form pindah stok. Disaring
    // outlet_id, wajib sejak migrasi 0028.
    supabase
      .from('v_product_stock')
      .select('id, name, sku, unit, stock')
      .eq('organization_id', orgId)
      .eq('outlet_id', session.outletId!)
      .eq('is_active', true)
      .eq('track_stock', true)
      .order('name'),
  ])

  const rows = outlets ?? []
  // Kuota dihitung dari baris yang belum di-soft-delete — sama persis dengan
  // `org_usage(_, 'outlets')` di database. Outlet nonaktif tetap terhitung.
  const limit =
    (org?.plans as unknown as { max_outlets: number | null } | null)?.max_outlets ?? null

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Outlet"
        subtitle="Cabang toko — masing-masing punya stok, kasir, dan struknya sendiri."
      />

      <OutletManager
        outlets={rows.map((o) => ({
          id: o.id,
          name: o.name,
          code: o.code,
          address: o.address,
          phone: o.phone,
          isPrimary: o.is_primary,
          isActive: o.is_active,
        }))}
        activeOutletId={session.outletId}
        quota={{ used: rows.length, limit }}
        products={(products ?? []).map((p) => ({
          id: p.id!,
          name: p.name ?? '—',
          sku: p.sku ?? '',
          unit: p.unit ?? 'pcs',
          stock: Number(p.stock ?? 0),
        }))}
      />
    </>
  )
}
