import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { OpnameSheet, type OpnameRow } from '@/components/domain/OpnameSheet'
import { ProdukTabs } from '@/components/domain/ProdukTabs'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Opname Stok | TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Opname satu sesi.
 *
 * Ditaruh di bawah Produk, bukan sebagai menu tersendiri: bottom nav ponsel
 * sudah pas 5 slot, dan menambah satu mendorong menu lain masuk lembar
 * "Lainnya". Alasannya sama dengan `/laporan/shift` dan
 * `/pembelian/konsinyasi`. Izinnya `products`, sama dengan Transfer Stok.
 */
export default async function OpnamePage() {
  const session = await requirePermission('products')
  const supabase = await createClient()

  const { data } = await supabase
    .from('v_product_stock')
    // WAJIB disaring outlet: view ini satu baris per produk PER OUTLET sejak
    // migrasi 0028. Tanpa saringan, produk muncul berulang per cabang dan
    // angka "stok tercatat" jadi milik cabang yang salah.
    .select('id, name, sku, unit, stock, track_stock')
    .eq('organization_id', session.org!.id)
    .eq('outlet_id', session.outletId!)
    .order('name')

  /**
   * Produk tanpa `track_stock` tidak ikut dihitung. Stoknya memang tidak
   * pernah dicatat, jadi kolom "stok tercatat" akan selalu 0 dan setiap angka
   * yang diketik terbaca sebagai selisih — daftar penuh selisih palsu yang
   * membuat selisih sungguhan tenggelam.
   */
  const rows: OpnameRow[] = (data ?? [])
    .filter((p) => p.track_stock !== false)
    .map((p) => ({
      id: p.id!,
      name: p.name!,
      sku: p.sku!,
      unit: p.unit ?? 'pcs',
      stock: p.stock ?? 0,
    }))

  const outletName =
    session.outlets.find((o) => o.id === session.outletId)?.name ?? session.org!.name

  return (
    <>
      <ProdukTabs />
      <PageHeader
        eyebrow={session.org!.name}
        title="Opname Stok"
        subtitle={`Hitung fisik barang di ${outletName}, lalu simpan sekali jalan. Baris yang dikosongkan berarti belum dihitung dan tidak akan diubah.`}
      />
      <OpnameSheet rows={rows} outletName={outletName} />
    </>
  )
}
