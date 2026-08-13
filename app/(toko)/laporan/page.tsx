import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { LaporanTabs } from '@/components/domain/LaporanTabs'
import { DailyRevenueChart, type DailyPoint } from '@/components/charts/DailyRevenueChart'
import { PaymentSplit } from '@/components/charts/PaymentSplit'
import { RankedBars } from '@/components/charts/RankedBars'
import { PlanLock } from '@/components/domain/PlanLock'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { rupiah } from '@/lib/format'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Laporan | TokoKu' }
export const dynamic = 'force-dynamic'

const TZ = 'Asia/Makassar'

/**
 * Pembagian paket di halaman ini.
 *
 * Prinsipnya sama dengan `purchasing` di migrasi 0024: JANGAN kunci hal yang
 * membuat toko berjalan benar, kunci lapisan ANALISANYA.
 *
 * `basic` tetap menjawab "berapa uang masuk" — omset, jumlah transaksi,
 * rata-rata, grafik harian, dan rincian per tanggal. Itu yang dibuka pemilik
 * warung tiap tutup toko, dan menguncinya membuat aplikasinya terasa rusak,
 * bukan terasa murah.
 *
 * `full` menambah yang menjawab "apa yang harus saya ubah": laba kotor &
 * margin, produk terlaris, komposisi metode bayar, dan rentang 90 hari.
 *
 * Laporan Shift sengaja TIDAK dikunci. Selisih kas itu pengamanan uang, bukan
 * analisa — menguncinya membuat uang hilang tanpa ketahuan, persis kategori
 * yang dilindungi prinsip di atas.
 */
const PERIODS = [
  { days: 7, label: '7 hari', full: false },
  { days: 30, label: '30 hari', full: false },
  { days: 90, label: '90 hari', full: true },
]

function dayList(days: number): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    out.push(d.toLocaleDateString('en-CA', { timeZone: TZ }))
  }
  return out
}

/** Nilai `?outlet=` yang berarti "jangan disaring". */
const ALL_OUTLETS = 'semua'

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; outlet?: string }>
}) {
  const session = await requirePermission('reports')
  const { periode, outlet } = await searchParams

  const supabase = await createClient()
  const orgId = session.org!.id
  const features = await getPlanFeatures(orgId)
  const fullReports = features.reports === 'full'

  // Periode di luar paket dikembalikan ke 7 hari, bukan ditolak: tautan lama,
  // bookmark, atau URL yang diketik tangan tidak boleh berakhir di halaman error.
  const picked = PERIODS.find((p) => String(p.days) === periode)
  const days = picked && (fullReports || !picked.full) ? picked.days : 7

  const dates = dayList(days)
  const from = dates[0]

  /**
   * Cakupan outlet.
   *
   * Bawaannya mengikuti outlet aktif di topbar — sama seperti seluruh aplikasi,
   * supaya tidak ada dua gagasan "outlet mana" yang berjalan bersamaan. Pilihan
   * "Semua outlet" disediakan terpisah karena pemilik yang sedang meninjau
   * usahanya di rumah memang menanyakan gabungan, bukan satu cabang.
   *
   * Pemilihnya hanya muncul kalau toko memang punya lebih dari satu cabang.
   */
  const multiOutlet = session.outlets.length > 1
  const allOutlets = multiOutlet && outlet === ALL_OUTLETS
  // Outlet yang diminta lewat URL divalidasi terhadap daftar milik toko ini —
  // id asing dijatuhkan diam-diam ke outlet aktif, bukan dijadikan halaman error.
  const requested =
    outlet && session.outlets.some((o) => o.id === outlet) ? outlet : null
  const scopedOutlet = allOutlets ? null : (requested ?? session.outletId)

  // Dipakai tiap tautan periode supaya berpindah rentang tidak diam-diam
  // mengembalikan cakupan ke outlet aktif.
  const scopeParam = allOutlets ? ALL_OUTLETS : (scopedOutlet ?? '')
  const scopeName = allOutlets
    ? 'semua outlet'
    : (session.outlets.find((o) => o.id === scopedOutlet)?.name ?? null)

  // `outlet_id` ikut diambil supaya baris yang sama bisa dipakai dua kali:
  // dijumlahkan per tanggal untuk grafik, dan dijumlahkan per cabang untuk
  // perbandingan di bawah. Satu query, bukan dua.
  const dailyQuery = supabase
    .from('v_daily_sales')
    .select('outlet_id, sales_date, revenue, cogs, gross_profit, transaction_count, qris_count, cash_count, cash_revenue, offline_count')
    .eq('organization_id', orgId)
    .gte('sales_date', from)
  const productQuery = supabase
    .from('v_product_sales')
    .select('product_id, product_name, qty_sold, revenue, gross_profit')
    .eq('organization_id', orgId)
    .gte('sales_date', from)

  const [{ data: daily }, { data: productSales }] = await Promise.all([
    scopedOutlet ? dailyQuery.eq('outlet_id', scopedOutlet) : dailyQuery,
    scopedOutlet ? productQuery.eq('outlet_id', scopedOutlet) : productQuery,
  ])

  /**
   * DIJUMLAHKAN per tanggal, bukan diambil satu baris per tanggal.
   *
   * `v_daily_sales` dikelompokkan per (organisasi, outlet, tanggal). Dulu
   * barisnya dimasukkan ke Map berkunci tanggal — dengan dua cabang yang
   * sama-sama berjualan, baris kedua MENIMPA yang pertama. Akibatnya grafik dan
   * tabel Rincian Harian menampilkan omset satu cabang saja, sementara ringkasan
   * di atasnya (yang memakai reduce atas semua baris) menjumlahkan keduanya —
   * dua angka berbeda untuk hal yang sama, di layar yang sama.
   */
  const byDate = new Map<string, { revenue: number; count: number; profit: number }>()
  for (const d of daily ?? []) {
    const key = d.sales_date as string
    const cur = byDate.get(key) ?? { revenue: 0, count: 0, profit: 0 }
    cur.revenue += Number(d.revenue ?? 0)
    cur.count += Number(d.transaction_count ?? 0)
    cur.profit += Number(d.gross_profit ?? 0)
    byDate.set(key, cur)
  }

  const points: DailyPoint[] = dates.map((date) => {
    const row = byDate.get(date)
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      revenue: row?.revenue ?? 0,
      count: row?.count ?? 0,
    }
  })

  const totals = (daily ?? []).reduce(
    (a, d) => ({
      revenue: a.revenue + Number(d.revenue ?? 0),
      profit: a.profit + Number(d.gross_profit ?? 0),
      count: a.count + Number(d.transaction_count ?? 0),
      qrisCount: a.qrisCount + Number(d.qris_count ?? 0),
      cashCount: a.cashCount + Number(d.cash_count ?? 0),
      cashRevenue: a.cashRevenue + Number(d.cash_revenue ?? 0),
      offline: a.offline + Number(d.offline_count ?? 0),
    }),
    { revenue: 0, profit: 0, count: 0, qrisCount: 0, cashCount: 0, cashRevenue: 0, offline: 0 },
  )

  const avgTicket = totals.count ? Math.round(totals.revenue / totals.count) : 0
  const marginPct = totals.revenue ? Math.round((totals.profit / totals.revenue) * 100) : 0

  /**
   * Perbandingan antar cabang — hanya saat cakupannya "Semua outlet".
   *
   * Sebelum ini, membandingkan dua cabang berarti berpindah tab bolak-balik dan
   * mengingat angkanya di kepala. Yang ditanyakan pemilik dua warung justru
   * perbandingan itu sendiri: "cabang mana yang jalan".
   *
   * Cabang yang belum berjualan sama sekali TETAP ditampilkan dengan nol.
   * Dibuang dari daftar, cabang yang sedang sepi jadi tidak terlihat — padahal
   * nol adalah jawaban yang paling perlu dilihat.
   */
  const perOutlet = allOutlets
    ? session.outlets.map((o) => {
        const rows = (daily ?? []).filter((d) => d.outlet_id === o.id)
        const revenue = rows.reduce((n, d) => n + Number(d.revenue ?? 0), 0)
        return {
          id: o.id,
          name: o.name,
          revenue,
          count: rows.reduce((n, d) => n + Number(d.transaction_count ?? 0), 0),
          profit: rows.reduce((n, d) => n + Number(d.gross_profit ?? 0), 0),
          share: totals.revenue ? Math.round((revenue / totals.revenue) * 100) : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
    : []

  // Gabungkan penjualan produk lintas hari
  const perProduct = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
  for (const r of productSales ?? []) {
    const key = (r.product_id as string) ?? (r.product_name as string)
    const cur = perProduct.get(key) ?? { name: r.product_name as string, qty: 0, revenue: 0, profit: 0 }
    cur.qty += Number(r.qty_sold ?? 0)
    cur.revenue += Number(r.revenue ?? 0)
    cur.profit += Number(r.gross_profit ?? 0)
    perProduct.set(key, cur)
  }
  const topProducts = [...perProduct.entries()]
    .map(([id, v]) => ({ id, label: v.name, value: v.revenue, sub: `${v.qty} terjual` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <>
      <LaporanTabs />
      <PageHeader
        eyebrow={session.org!.name}
        title="Laporan"
        subtitle={
          multiOutlet && scopeName
            ? `Penjualan ${scopeName} · ${days} hari terakhir`
            : `Penjualan ${days} hari terakhir`
        }
      />

      {/* Cakupan outlet — hanya saat cabangnya memang lebih dari satu.
          Ditaruh SEBELUM pemilih periode karena ia menentukan angka siapa yang
          sedang dibaca; periode hanya menentukan rentangnya. */}
      {multiOutlet && (
        <div className="period-tabs" style={{ marginBottom: 10 }}>
          {session.outlets.map((o) => (
            <Link
              key={o.id}
              href={`/laporan?periode=${days}&outlet=${o.id}`}
              className="btn btn-ghost btn-sm"
              style={
                !allOutlets && o.id === scopedOutlet
                  ? { background: 'var(--color-forest)', color: 'var(--color-mint)', borderColor: 'var(--color-forest)' }
                  : undefined
              }
            >
              {o.name}
            </Link>
          ))}
          <Link
            href={`/laporan?periode=${days}&outlet=${ALL_OUTLETS}`}
            className="btn btn-ghost btn-sm"
            style={
              allOutlets
                ? { background: 'var(--color-forest)', color: 'var(--color-mint)', borderColor: 'var(--color-forest)' }
                : undefined
            }
          >
            Semua outlet
          </Link>
        </div>
      )}

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PERIODS.map((p) => {
          // Periode terkunci tetap TAMPIL, sebagai tombol mati bertanda paket.
          // Dihilangkan, pemilik toko tidak pernah tahu rentang itu ada.
          const locked = p.full && !fullReports
          if (locked) {
            return (
              <span key={p.days} className="btn btn-ghost btn-sm period-locked" aria-disabled>
                {p.label} · Growth
              </span>
            )
          }
          return (
            <Link
              key={p.days}
              href={`/laporan?periode=${p.days}&outlet=${scopeParam}`}
              className="btn btn-ghost btn-sm"
              style={
                p.days === days
                  ? { background: 'var(--color-forest)', color: 'var(--color-mint)', borderColor: 'var(--color-forest)' }
                  : undefined
              }
            >
              {p.label}
            </Link>
          )
        })}
      </div>

      <div className="hero">
        <div className="hero-label">Omset {days} Hari</div>
        <div className="hero-num">{rupiah(totals.revenue)}</div>
        <div className="hero-meta">
          <div><b>{totals.count}</b><span>Transaksi</span></div>
          <div><b>{rupiah(avgTicket)}</b><span>Rata-rata/transaksi</span></div>
          {fullReports && (
            <div><b>{rupiah(totals.profit)}</b><span>Laba kotor ({marginPct}%)</span></div>
          )}
        </div>
      </div>

      {totals.offline > 0 && (
        <div className="empty-note is-warn" style={{ marginBottom: 16 }}>
          <Icon name="wifiOff" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            {totals.offline} transaksi dibuat saat perangkat offline. Semuanya sudah masuk
            hitungan ini menurut jam kasir, bukan jam masuk server.
          </div>
        </div>
      )}

      {perOutlet.length > 0 && (
        <>
          <div className="section-title">Per Cabang</div>
          <div className="card">
            <RankedBars
              items={perOutlet.map((o) => ({
                id: o.id,
                label: o.name,
                value: o.revenue,
                sub: `${o.count} transaksi · ${o.share}%`,
              }))}
            />
          </div>

          {/* Tabel angkanya menyusul batangnya: batang menjawab "mana yang
              lebih besar" dalam sekejap, tabel menjawab "berapa persisnya"
              tanpa perlu menebak dari panjang batang. */}
          <div className="table-card" style={{ marginTop: 10 }}>
            <div className="table-scroll">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th style={{ textAlign: 'right' }}>Transaksi</th>
                    <th style={{ textAlign: 'right' }}>Omset</th>
                    {fullReports && <th style={{ textAlign: 'right' }}>Laba Kotor</th>}
                  </tr>
                </thead>
                <tbody>
                  {perOutlet.map((o) => (
                    <tr key={o.id}>
                      <td className="cm-name">
                        <div className="cell-name">{o.name}</div>
                        <div className="cell-sub">{o.share}% dari omset</div>
                      </td>
                      <td className="cm-trx" style={{ textAlign: 'right' }}>
                        {o.count}
                      </td>
                      <td className="cm-rev" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {rupiah(o.revenue)}
                      </td>
                      {fullReports && (
                        <td className="cm-profit" style={{ textAlign: 'right' }}>
                          {rupiah(o.profit)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="section-title">Omset Harian</div>
      <div className="card">
        <DailyRevenueChart data={points} />
      </div>

      {/* Dua bagian ini pendek dan setara; disandingkan supaya layar lebar
          tidak berisi dua kartu melar bertumpuk. */}
      <div className="wide-cols">
        <div>
      <div className="section-title">Produk Terlaris</div>
      {fullReports ? (
        <div className="card">
          <RankedBars items={topProducts} />
        </div>
      ) : (
        <PlanLock>
          Urutan barang yang paling banyak menghasilkan uang, supaya yang laku tidak pernah
          kehabisan stok dan yang mengendap tidak dibelanjakan lagi.
        </PlanLock>
      )}

        </div>
        <div>
      <div className="section-title">Metode Pembayaran</div>
      {fullReports ? (
        <div className="card">
          <PaymentSplit
            qris={{ count: totals.qrisCount, revenue: totals.revenue - totals.cashRevenue }}
            cash={{ count: totals.cashCount, revenue: totals.cashRevenue }}
          />
        </div>
      ) : (
        <PlanLock>
          Perbandingan tunai dan QRIS, supaya ketahuan berapa uang yang seharusnya ada di laci
          dan berapa yang masuk rekening.
        </PlanLock>
      )}

        </div>
      </div>

      {/* Tabel angka mentah — jalur baca yang tidak bergantung warna atau hover. */}
      <div className="section-title">Rincian Harian</div>
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Transaksi</th>
                <th style={{ textAlign: 'right' }}>Omset</th>
                {fullReports && <th style={{ textAlign: 'right' }}>Laba Kotor</th>}
              </tr>
            </thead>
            <tbody>
              {points
                .slice()
                .reverse()
                .map((p) => {
                  const row = byDate.get(p.date)
                  return (
                    <tr key={p.date}>
                      <td>{p.label}</td>
                      <td>{p.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupiah(p.revenue)}</td>
                      {fullReports && (
                        <td style={{ textAlign: 'right' }}>{rupiah(row?.profit ?? 0)}</td>
                      )}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {!fullReports && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          Paket ini menampilkan omset, jumlah transaksi, dan rincian hariannya. Semua penjualan
          tetap tercatat lengkap, termasuk yang dibuat saat kasir offline. Laba kotor, produk
          terlaris, komposisi metode bayar, dan rentang 90 hari tersedia mulai paket Growth.
        </p>
      )}
    </>
  )
}
