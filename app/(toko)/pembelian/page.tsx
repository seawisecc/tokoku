import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { PembelianTabs } from '@/components/domain/PembelianTabs'
import { PurchaseList } from '@/components/domain/PurchaseList'
import { requirePermission } from '@/lib/auth'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pembelian | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PembelianPage() {
  const session = await requirePermission('products')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: purchases }, { data: products }, { data: suppliers }, features] =
    await Promise.all([
      supabase
        // SENGAJA se-toko, tidak disaring per outlet.
        //
        // Nota tempo yang belum lunas adalah HUTANG TOKO, bukan hutang cabang —
        // pemiliknya yang membayar, dari kas yang sama. Disaring per outlet,
        // tagihan cabang lain hilang dari daftar dan dari spanduk "belum lunas"
        // di atasnya, tanpa ada apa pun di layar yang memberi tahu ada yang
        // disembunyikan. Yang dibutuhkan bukan saringan, melainkan LABEL cabang.
        .from('purchases')
        .select('id, code, invoice_no, purchased_at, total, payment, payment_method, due_date, paid_at, paid_note, outlet_id, suppliers(name)')
        .eq('organization_id', orgId)
        .order('purchased_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('products')
        .select('id, name, sku, unit, cost_price')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('name'),
      getPlanFeatures(orgId),
    ])

  const canUseSupplier = features.purchasing === 'full'
  // Nama cabang hanya disebut kalau tokonya memang bercabang.
  const outletName = new Map(
    session.outlets.length > 1 ? session.outlets.map((o) => [o.id, o.name]) : [],
  )

  return (
    <>
      <PembelianTabs full={canUseSupplier} />
      <PageHeader
        eyebrow={session.org!.name}
        title="Pembelian"
        subtitle="Catat barang masuk. Stok bertambah dan harga pokok ikut diperbarui."
      />

      <PurchaseList
        purchases={(purchases ?? []).map((p) => ({
          id: p.id,
          code: p.code,
          invoiceNo: p.invoice_no,
          purchasedAt: p.purchased_at,
          total: Number(p.total ?? 0),
          payment: p.payment,
          dueDate: p.due_date,
          paidAt: p.paid_at,
          paidNote: p.paid_note,
          paymentMethod: p.payment_method,
          supplierName: (p.suppliers as unknown as { name: string } | null)?.name ?? null,
          outletName: outletName.get(p.outlet_id) ?? null,
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          costPrice: Number(p.cost_price ?? 0),
        }))}
        suppliers={suppliers ?? []}
        canUseSupplier={canUseSupplier}
      />
    </>
  )
}
