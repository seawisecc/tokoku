import type { Metadata } from 'next'
import { PosClient } from '@/components/pos/PosClient'
import { isLapsed, subscriptionState } from '@/lib/subscription'
import { requirePermission } from '@/lib/auth'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kasir | TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Halaman kasir merender katalog awal di server, lalu menyerahkan seluruh
 * interaksi ke klien. Katalog dikirim langsung bersama HTML supaya kasir bisa
 * bekerja segera tanpa menunggu satu putaran jaringan tambahan — dan supaya
 * kunjungan berikutnya, walau tanpa internet, sudah punya isinya di IndexedDB.
 */
export default async function KasirPage() {
  const session = await requirePermission('pos')
  const supabase = await createClient()
  const orgId = session.org!.id

  if (!session.outletId) {
    return (
      <div className="placeholder-card">
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-ink)' }}>
          Akun ini belum ditugaskan ke outlet
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          Minta pemilik toko menetapkan outlet untuk akun Anda.
        </p>
      </div>
    )
  }

  const [{ data: products }, { data: categories }, { data: org }, { data: outlet }, features] =
    await Promise.all([
    supabase
      .from('v_product_stock')
      .select(
        'id, sku, barcode, name, category_id, sell_price, cost_price, unit, track_stock, min_stock, is_active, stock, promo_price, promo_starts_at, promo_ends_at',
      )
      .eq('organization_id', orgId)
      .eq('outlet_id', session.outletId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, color_key, sort_order')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('organizations')
      .select(
        'name, address, phone, allow_negative_stock, logo_url, loyalty_enabled, loyalty_point_value, max_manual_discount_percent',
      )
      .eq('id', orgId)
      .single(),
    supabase
      .from('outlets')
      .select('name, receipt_settings')
      .eq('id', session.outletId)
      .single(),
    getPlanFeatures(orgId),
  ])

  // Satu kali dibaca, dipakai dua kali di bawah — `receipt_settings` adalah
  // jsonb bebas bentuk, jadi lebih baik di-cast sekali daripada di tiap tempat.
  const receiptSettings = (outlet?.receipt_settings ?? {}) as {
    footer?: string
    show_logo?: boolean
  }

  return (
    <PosClient
      subscriptionLapsed={isLapsed(subscriptionState(session.org))}
      organizationId={orgId}
      outletId={session.outletId}
      cashierName={session.fullName}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      allowNegativeStock={org?.allow_negative_stock ?? false}
      /* Sakelar toko DAN gerbang paket digabung di sini. Poin adalah lapisan
         analisa (paket `full`), sementara mencatat pelanggan tetap terbuka di
         paket bawah — lihat "Pembagian paket". Digabung di server supaya kasir
         tidak pernah melihat tombol tukar poin yang lalu ditolak diam-diam. */
      loyalty={{
        enabled: org?.loyalty_enabled === true && features.crm === 'full',
        pointValue: Number(org?.loyalty_point_value ?? 0),
      }}
      /* 0 = tombol diskon tidak muncul sama sekali di layar bayar. Bawaannya
         memang 0 sampai pemilik toko menyalakannya di Pengaturan → Toko. */
      maxManualDiscountPercent={Number(org?.max_manual_discount_percent ?? 0)}
      store={{
        name: org?.name ?? 'Toko',
        outletName: outlet?.name ?? null,
        // Sakelarnya bawaan MENYALA — toko yang sudah repot mengunggah logo
        // hampir pasti ingin logonya tercetak. Yang tidak punya logo tetap
        // tidak mencetak apa pun karena logo_url-nya null.
        logoUrl: receiptSettings.show_logo === false ? null : (org?.logo_url ?? null),
        address: org?.address ?? null,
        phone: org?.phone ?? null,
        receiptFooter: receiptSettings.footer ?? null,
      }}
      initialProducts={(products ?? []) as never}
      initialCategories={categories ?? []}
    />
  )
}
