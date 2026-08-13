import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProdukTabs } from '@/components/domain/ProdukTabs'
import { ProductTable, type ProductRow } from '@/components/domain/ProductTable'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Produk & Stok | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function ProdukPage() {
  const session = await requirePermission('products')
  const supabase = await createClient()

  const [{ data: products }, { data: categories }, { data: org }] = await Promise.all([
    supabase
      .from('v_product_stock')
      .select(
        'id, name, sku, barcode, category_id, category_name, color_key, unit, cost_price, sell_price, min_stock, track_stock, stock, is_low_stock, promo_price, promo_starts_at, promo_ends_at, effective_price',
      )
      .eq('organization_id', session.org!.id)
      .eq('outlet_id', session.outletId!)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', session.org!.id)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('organizations')
      .select('low_stock_threshold')
      .eq('id', session.org!.id)
      .maybeSingle(),
  ])

  const rows: ProductRow[] = (products ?? []).map((p) => ({
    id: p.id!,
    name: p.name!,
    sku: p.sku!,
    barcode: p.barcode,
    categoryId: p.category_id,
    categoryName: p.category_name,
    colorKey: p.color_key,
    unit: p.unit ?? 'pcs',
    costPrice: p.cost_price ?? 0,
    sellPrice: p.sell_price ?? 0,
    minStock: p.min_stock ?? 0,
    trackStock: p.track_stock ?? true,
    stock: p.stock ?? 0,
    isLowStock: p.is_low_stock ?? false,
    promoPrice: p.promo_price,
    promoStartsAt: p.promo_starts_at,
    promoEndsAt: p.promo_ends_at,
    effectivePrice: p.effective_price ?? p.sell_price ?? 0,
  }))

  const lowCount = rows.filter((r) => r.trackStock && r.isLowStock).length

  return (
    <>
      <ProdukTabs />
      <PageHeader
        eyebrow={session.org!.name}
        title="Produk & Stok"
        subtitle={
          lowCount > 0
            ? `${rows.length} produk · ${lowCount} perlu restock`
            : `${rows.length} produk`
        }
      />
      <ProductTable
        products={rows}
        categories={categories ?? []}
        canEdit
        defaultMinStock={org?.low_stock_threshold ?? 10}
      />

      {/* Hanya muncul kalau tokonya memang punya cabang. Satu outlet, tidak ada
          yang bisa dipindahkan ke mana pun. */}
      {session.outlets.length > 1 && (
        <Link href="/produk/transfer" className="link-card" style={{ marginTop: 14 }}>
          <Icon name="layers" size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cell-name">Pindah Stok</div>
            <div className="cell-sub">
              Pindahkan barang antar cabang dan lihat riwayat perpindahannya.
            </div>
          </div>
          <Icon name="chevronRight" size={14} />
        </Link>
      )}
    </>
  )
}
