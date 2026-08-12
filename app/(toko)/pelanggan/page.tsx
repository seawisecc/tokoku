import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { CustomerManager, type CustomerRow } from '@/components/domain/CustomerManager'
import { PlanLock } from '@/components/domain/PlanLock'
import { requirePermission } from '@/lib/auth'
import { getPlanFeatures } from '@/lib/plan'
import { rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pelanggan | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function PelangganPage() {
  const session = await requirePermission('reports')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: rows }, { data: org }, features] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone, email, address, note, total_spent, visit_count, last_visit_at, points')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from('organizations')
      .select('loyalty_enabled, loyalty_earn_per, loyalty_point_value')
      .eq('id', orgId)
      .maybeSingle(),
    getPlanFeatures(orgId),
  ])

  /**
   * Pelanggan TIDAK disaring per outlet, dan itu disengaja.
   *
   * Orang yang sama berbelanja di cabang mana pun, dan poinnya satu. Disaring
   * per cabang, kasir di Renon tidak menemukan pelanggan yang tadi pagi
   * didaftarkan di cabang utama lalu membuatnya lagi, dan saldo poinnya
   * terpecah dua tanpa ada yang menyadarinya.
   */
  const customers: CustomerRow[] = (rows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    note: c.note,
    totalSpent: Number(c.total_spent ?? 0),
    visitCount: Number(c.visit_count ?? 0),
    lastVisitAt: c.last_visit_at,
    points: Number(c.points ?? 0),
  }))

  const full = features.crm === 'full'
  const loyaltyOn = org?.loyalty_enabled === true
  const belanjaTotal = customers.reduce((n, c) => n + c.totalSpent, 0)

  return (
    <>
      <PageHeader
        eyebrow={session.org!.name}
        title="Pelanggan"
        subtitle={
          customers.length > 0
            ? `${customers.length} pelanggan tercatat${full ? ` · ${rupiah(belanjaTotal)} total belanja` : ''}`
            : 'Catat pembeli langganan supaya notanya bisa dikirim dan belanjanya terlacak.'
        }
      />

      <CustomerManager customers={customers} loyaltyOn={loyaltyOn} full={full} />

      {full ? (
        loyaltyOn ? (
          <div className="field-hint" style={{ marginTop: 12 }}>
            Poin bertambah otomatis setiap transaksi lunas: 1 poin per{' '}
            {rupiah(Number(org?.loyalty_earn_per ?? 10000))} belanja, dan 1 poin bernilai{' '}
            {rupiah(Number(org?.loyalty_point_value ?? 100))} saat ditukar. Transaksi yang
            dibatalkan mengembalikan poinnya.
          </div>
        ) : (
          <div className="field-hint" style={{ marginTop: 12 }}>
            Poin loyalty belum dinyalakan. Aktifkan di Pengaturan → Toko kalau ingin setiap
            belanja mengumpulkan poin.
          </div>
        )
      ) : (
        <>
          <div className="section-title">Loyalty & Riwayat Belanja</div>
          <PlanLock>
            Paket ini mencatat pelanggan dan mengirim nota lewat WhatsApp. Poin loyalty, total
            belanja per pelanggan, dan penanda pelanggan yang lama tidak datang ada di paket
            Growth ke atas.
          </PlanLock>
        </>
      )}
    </>
  )
}
