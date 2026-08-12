import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PembelianTabs } from '@/components/domain/PembelianTabs'
import { ConsignmentList } from '@/components/domain/ConsignmentList'
import { requirePermission } from '@/lib/auth'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Konsinyasi | TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Konsinyasi — titip jual.
 *
 * Sengaja di bawah /pembelian, bukan item nav sendiri. Bottom nav ponsel sudah
 * pas lima slot (lihat splitBottomNav); menu kedelapan akan mendorong menu lain
 * masuk lembar "Lainnya". Polanya sama dengan /laporan/shift.
 *
 * Ikut gerbang paket `purchasing`, karena konsinyasi TIDAK bisa berdiri tanpa
 * pemasok: setiap titipan harus punya pemiliknya, dan bagi hasil dibayar per
 * pemasok. Paket yang hanya mencatat barang masuk tidak punya bahan itu.
 */
export default async function KonsinyasiPage() {
  const session = await requirePermission('products')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [features, { data: rows }, { data: products }, { data: suppliers }, { data: settlements }] =
    await Promise.all([
      getPlanFeatures(orgId),
      supabase
        // SENGAJA se-toko, tidak disaring per outlet — dan di sini alasannya
        // lebih keras daripada di Pembelian: `settle_consignment` menghitung
        // bagi hasil untuk SELURUH titipan pemasok itu lintas outlet. Kalau
        // layarnya disaring per cabang, angka "belum disetor" yang dibaca
        // pemilik toko tidak akan sama dengan rupiah yang benar-benar dibayarkan
        // saat tombol Setor ditekan.
        .from('v_consignment_summary')
        .select('*')
        .eq('organization_id', orgId)
        .order('ended_at', { ascending: true, nullsFirst: true })
        .order('supplier_name')
        .order('product_name'),
      // v_product_stock, bukan products: drawer perlu tahu stok yang sudah ada
      // untuk memperingatkan produk yang bercampur milik toko sendiri.
      supabase
        .from('v_product_stock')
        .select('id, name, sku, unit, sell_price, track_stock, stock')
        .eq('organization_id', orgId)
        // WAJIB sejak migrasi 0028 — tanpa ini tiap produk muncul sekali per cabang.
        .eq('outlet_id', session.outletId!)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('consignment_settlements')
        .select('id, code, settled_on, total_quantity, total, note, suppliers(name)')
        .eq('organization_id', orgId)
        .order('settled_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  if (features.purchasing !== 'full') redirect('/pembelian')

  // Nama cabang hanya disebut kalau tokonya memang bercabang.
  const outletName = new Map(
    session.outlets.length > 1 ? session.outlets.map((o) => [o.id, o.name]) : [],
  )

  return (
    <>
      <PembelianTabs full />
      <PageHeader
        eyebrow={
          <Link href="/pembelian" style={{ color: 'inherit' }}>
            ← Pembelian
          </Link>
        }
        title="Konsinyasi"
        subtitle="Barang titipan pemasok. Toko hanya berhutang atas yang terjual."
      />

      <ConsignmentList
        rows={(rows ?? []).map((r) => ({
          id: r.id!,
          supplierId: r.supplier_id!,
          supplierName: r.supplier_name ?? '-',
          productId: r.product_id!,
          productName: r.product_name ?? '-',
          sku: r.sku ?? '',
          unit: r.unit ?? 'pcs',
          sellPrice: Number(r.sell_price ?? 0),
          consignPrice: Number(r.consign_price ?? 0),
          qtyIn: Number(r.qty_in ?? 0),
          qtyReturned: Number(r.qty_returned ?? 0),
          qtySold: Number(r.qty_sold ?? 0),
          qtyLeft: Number(r.qty_left ?? 0),
          qtyUnsettled: Number(r.qty_unsettled ?? 0),
          amountDue: Number(r.amount_due ?? 0),
          endedAt: r.ended_at,
          outletName: outletName.get(r.outlet_id ?? '') ?? null,
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id!,
          name: p.name ?? '-',
          sku: p.sku ?? '',
          unit: p.unit ?? 'pcs',
          sellPrice: Number(p.sell_price ?? 0),
          trackStock: p.track_stock ?? true,
          stock: Number(p.stock ?? 0),
        }))}
        suppliers={suppliers ?? []}
        settlements={(settlements ?? []).map((s) => ({
          id: s.id,
          code: s.code,
          settledOn: s.settled_on,
          quantity: Number(s.total_quantity ?? 0),
          total: Number(s.total ?? 0),
          note: s.note,
          supplierName: (s.suppliers as unknown as { name: string } | null)?.name ?? '-',
        }))}
      />
    </>
  )
}
