import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  ClientDetail,
  type ClientDetailData,
  type SubscriptionEvent,
} from '@/components/domain/ClientDetail'
import { Icon } from '@/components/ui/icons'
import { requirePlatformAdmin } from '@/lib/auth'
import { tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Detail Klien | Super Admin' }
export const dynamic = 'force-dynamic'

export default async function KlienDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePlatformAdmin()
  const supabase = await createClient()

  const [
    { data: row },
    { data: org },
    { data: plans },
    { data: sessions },
    { data: quota },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('v_client_overview')
      .select('id, name, city, status, plan_code, plan_name, outlet_count, user_count, product_count, revenue_mtd, joined_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('plan_id, status, trial_ends_at, status_changed_at')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('plans').select('id, name, code, price_monthly').eq('is_active', true).order('sort_order'),
    supabase
      .from('impersonation_sessions')
      .select('id, reason, started_at, ended_at, profiles:admin_user_id(full_name)')
      .eq('organization_id', id)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase.from('v_client_quota').select('*').eq('organization_id', id).maybeSingle(),
    supabase
      .from('subscription_events')
      .select('id, action, amount, created_at, plan:plan_id(name), from_plan:from_plan_id(name)')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!row) notFound()

  const client: ClientDetailData = {
    id: row.id!,
    name: row.name!,
    city: row.city,
    status: row.status ?? 'trial',
    planId: org?.plan_id ?? null,
    outletCount: Number(row.outlet_count ?? 0),
    userCount: Number(row.user_count ?? 0),
    productCount: Number(row.product_count ?? 0),
    revenueMtd: Number(row.revenue_mtd ?? 0),
    quota: quota
      ? {
          maxOutlets: quota.max_outlets,
          maxUsers: quota.max_users,
          maxProducts: quota.max_products,
          maxDevices: quota.max_devices,
          usedOutlets: quota.used_outlets ?? 0,
          usedUsers: quota.used_users ?? 0,
          usedProducts: quota.used_products ?? 0,
          usedDevices: quota.used_devices ?? 0,
        }
      : null,
    trialEndsAt: org?.trial_ends_at ? org.trial_ends_at.slice(0, 10) : null,
    // Dihitung di sini, bukan lewat org_is_active(): fungsi itu sengaja tidak
    // bisa dipanggil dari luar (lihat migrasi 0019 & 0021).
    lapsed:
      org?.status === 'suspended' ||
      org?.status === 'inactive' ||
      (org?.status === 'trial' &&
        !!org?.trial_ends_at &&
        new Date(org.trial_ends_at) <= new Date()),
  }

  const subscriptionEvents: SubscriptionEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    amount: Number(e.amount ?? 0),
    at: tanggal(e.created_at),
    toPlan: (e.plan as unknown as { name: string } | null)?.name ?? null,
    fromPlan: (e.from_plan as unknown as { name: string } | null)?.name ?? null,
  }))

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/admin/klien" style={{ color: 'inherit' }}>← Klien</Link>}
        title={client.name}
        subtitle={`${client.city ?? '-'} · bergabung ${tanggal(row.joined_at)}`}
      />

      <ClientDetail
        client={client}
        plans={(plans ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          priceMonthly: p.price_monthly,
        }))}
        events={subscriptionEvents}
      />

      {/* Ekspor data klien.
          Ada karena satu keadaan yang nyata: klien menelepon minta backup dan
          tidak pernah berhasil menemukan menunya sendiri. Tanpa jalur ini,
          satu-satunya cara menolongnya adalah membuka SQL editor lalu
          menempelkan hasilnya ke spreadsheet dengan tangan.

          Hanya BACA, dan itu disengaja: impor tetap dikerjakan klien sendiri
          di Pengaturan → Data. Begitu admin bisa memasukkan barang atas nama
          klien, pertanyaan "siapa yang mengubah daftar harga saya" kehilangan
          jawaban tunggalnya. */}
      <div className="section-title">Ekspor Data Klien</div>
      <div className="unduh-grid">
        {[
          { jenis: 'produk', judul: 'Daftar Produk', jelas: 'Siap diimpor kembali oleh klien.' },
          { jenis: 'pelanggan', judul: 'Daftar Pelanggan', jelas: 'Termasuk saldo poin.' },
          {
            jenis: 'transaksi',
            judul: 'Riwayat Transaksi',
            jelas: 'Semua cabang, satu baris per nota.',
          },
          {
            jenis: 'item',
            judul: 'Rincian Barang Terjual',
            jelas: 'Satu baris per barang di tiap nota.',
          },
        ].map((x) => (
          <a
            key={x.jenis}
            className="unduh-kartu"
            href={`/admin/klien/${client.id}/ekspor?jenis=${x.jenis}&hari=3650`}
            download
          >
            <div className="unduh-ikon">
              <Icon name="layers" size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cell-name">{x.judul}</div>
              <div className="cell-sub">{x.jelas}</div>
            </div>
          </a>
        ))}
      </div>
      <p className="field-hint" style={{ marginTop: 10 }}>
        Hanya membaca. Untuk memasukkan data, arahkan klien ke Pengaturan → Impor &amp; Backup
        di aplikasinya sendiri supaya perubahannya tercatat atas namanya.
      </p>

      {(sessions ?? []).length > 0 && (
        <>
          <div className="section-title">Riwayat Akses Super Admin</div>
          <div className="table-card">
            <div className="table-scroll">
              <table>
                <tbody>
                  {(sessions ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-name">
                          {(s.profiles as unknown as { full_name: string } | null)?.full_name ?? '-'}
                        </div>
                        <div className="cell-sub">{s.reason ?? 'Tanpa alasan'}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-ink-faint)' }}>
                        {tanggal(s.started_at)}
                      </td>
                      <td>
                        <span className={`badge ${s.ended_at ? 'badge-ok' : 'badge-trial'}`}>
                          {s.ended_at ? 'Selesai' : 'Berjalan'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
