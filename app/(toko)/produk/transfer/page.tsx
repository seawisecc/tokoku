import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { TransferManager } from '@/components/domain/TransferManager'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pindah Stok | TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Riwayat pindah stok antar cabang.
 *
 * Ditaruh di bawah /produk, bukan /pengaturan/outlet, karena izinnya memang
 * `products`: memindahkan barang adalah operasi stok, bukan mengubah struktur
 * toko. Sempat hanya ada tombolnya di halaman Outlet — dan halaman itu butuh
 * izin `settings`, sehingga admin toko yang mengurus stok tapi tidak memegang
 * pengaturan tidak punya jalan sama sekali ke fitur yang secara aturan boleh
 * ia pakai.
 *
 * Tombol di halaman Outlet tetap ada: pemilik yang sedang berpikir soal cabang
 * mencarinya di sana. Dua pintu ke satu tindakan yang sama.
 */
export default async function PindahStokPage() {
  const session = await requirePermission('products')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: outlets }, { data: products }, { data: transfers }] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, is_active')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('name'),
    supabase
      .from('v_product_stock')
      .select('id, name, sku, unit, stock')
      .eq('organization_id', orgId)
      .eq('outlet_id', session.outletId!)
      .eq('is_active', true)
      .eq('track_stock', true)
      .order('name'),
    // Riwayat lengkap toko, TIDAK disaring outlet aktif: sebuah transfer punya
    // dua sisi dan keduanya sama-sama nyata. Disaring, nota yang sama hilang
    // dari layar begitu orang berpindah ke cabang lawannya.
    supabase
      .from('stock_transfers')
      .select(
        'id, code, transferred_on, note, from_outlet_id, to_outlet_id, stock_transfer_items(quantity, products(name, unit))',
      )
      .eq('organization_id', orgId)
      .order('transferred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const outletName = new Map((outlets ?? []).map((o) => [o.id, o.name]))
  const active = (outlets ?? []).find((o) => o.id === session.outletId)

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/produk" style={{ color: 'inherit' }}>
            ← Produk &amp; Stok
          </Link>
        }
        title="Pindah Stok"
        subtitle="Perpindahan barang antar cabang. Stok turun di asal dan naik di tujuan seketika."
      />

      <TransferManager
        fromOutlet={
          active ? { id: active.id, name: active.name, isActive: active.is_active } : null
        }
        outlets={(outlets ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          isActive: o.is_active,
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id!,
          name: p.name ?? '-',
          sku: p.sku ?? '',
          unit: p.unit ?? 'pcs',
          stock: Number(p.stock ?? 0),
        }))}
        transfers={(transfers ?? []).map((t) => {
          const items = (t.stock_transfer_items ?? []) as unknown as {
            quantity: number
            products: { name: string; unit: string } | null
          }[]
          return {
            id: t.id,
            code: t.code,
            transferredOn: t.transferred_on,
            note: t.note,
            fromName: outletName.get(t.from_outlet_id) ?? '-',
            toName: outletName.get(t.to_outlet_id) ?? '-',
            totalQty: items.reduce((n, i) => n + Number(i.quantity ?? 0), 0),
            items: items.map((i) => ({
              name: i.products?.name ?? '-',
              unit: i.products?.unit ?? 'pcs',
              quantity: Number(i.quantity ?? 0),
            })),
          }
        })}
      />
    </>
  )
}
