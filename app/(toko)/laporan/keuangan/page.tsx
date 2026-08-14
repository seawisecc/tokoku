import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { ExportReportButton } from '@/components/domain/ExportReportButton'
import { LaporanTabs } from '@/components/domain/LaporanTabs'
import { PlanLock } from '@/components/domain/PlanLock'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn, rupiah } from '@/lib/format'
import { namaBulan, PERIODE, PERIODE_LABEL, periodeSah, rentangPeriode } from '@/lib/period'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Laporan Keuangan | TokoKu' }
export const dynamic = 'force-dynamic'

/** Nilai `?outlet=` yang berarti "jangan disaring". Sama dengan Laporan Penjualan. */
const ALL_OUTLETS = 'semua'

type FlowRow = {
  outlet_id: string | null
  flow_date: string
  source: string
  direction: string
  is_cash: boolean
  amount: number
}

export default async function LaporanKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; outlet?: string }>
}) {
  const session = await requirePermission('reports')
  const { periode, outlet } = await searchParams
  const aktif = periodeSah(periode)
  const { from, to } = rentangPeriode(aktif)

  const supabase = await createClient()
  const orgId = session.org!.id
  const features = await getPlanFeatures(orgId)

  // Cakupan outlet: aturannya disalin dari Laporan Penjualan supaya dua halaman
  // di bagian yang sama tidak punya dua gagasan "outlet mana". Id asing
  // dijatuhkan diam-diam ke outlet aktif, bukan dijadikan halaman error.
  const multiOutlet = session.outlets.length > 1
  const allOutlets = multiOutlet && outlet === ALL_OUTLETS
  const requested = outlet && session.outlets.some((o) => o.id === outlet) ? outlet : null
  const scopedOutlet = allOutlets ? null : (requested ?? session.outletId)
  const scopeParam = allOutlets ? ALL_OUTLETS : (scopedOutlet ?? '')
  const scopeName = allOutlets
    ? 'semua outlet'
    : (session.outlets.find((o) => o.id === scopedOutlet)?.name ?? null)

  const tautan = (p: string, o: string) =>
    `/laporan/keuangan?periode=${p}${o ? `&outlet=${o}` : ''}` as Route

  if (features.reports !== 'full') {
    return (
      <>
        <LaporanTabs />
        <PageHeader
          eyebrow={session.org!.name}
          title="Laporan Keuangan"
          subtitle="Arus kas dan laba rugi dalam satu halaman."
        />
        <PlanLock>
          Laba bersih, arus kas masuk dan keluar, serta rincian pengeluaran per kategori tersedia
          mulai paket Growth. Pencatatan pengeluarannya sendiri tetap terbuka di paket ini, jadi
          datanya sudah terkumpul dan langsung terbaca begitu paketnya naik.
        </PlanLock>
        <Link href="/laporan/pengeluaran" className="link-card" style={{ marginTop: 14 }}>
          <Icon name="sliders" size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cell-name">Catat Pengeluaran</div>
            <div className="cell-sub">Sewa, listrik, gaji, dan biaya lain yang tidak menambah stok.</div>
          </div>
          <Icon name="chevronRight" size={14} />
        </Link>
      </>
    )
  }

  const plQuery = supabase
    .from('v_profit_loss')
    .select('outlet_id, period_month, net_revenue, tax_collected, cogs, gross_profit, transaction_count')
    .eq('organization_id', orgId)
    .gte('period_month', from)
    .lte('period_month', to)
    .order('period_month')

  const expQuery = supabase
    .from('v_expense_monthly')
    .select('outlet_id, period_month, category_name, amount')
    .eq('organization_id', orgId)
    .gte('period_month', from)
    .lte('period_month', to)

  const cfQuery = supabase
    .from('v_cash_flow')
    .select('outlet_id, flow_date, source, direction, is_cash, amount')
    .eq('organization_id', orgId)
    .gte('flow_date', from)
    .lte('flow_date', to)

  /**
   * Penjualan tidak pernah ber-`outlet_id` NULL, tapi PENGELUARAN bisa, dan
   * NULL di sana berarti "seluruh toko" (gaji admin, langganan internet).
   * Saringan `eq` biasa membuangnya dari SEMUA cabang sekaligus, sehingga biaya
   * yang justru paling besar tidak muncul di laporan mana pun — dan tidak ada
   * apa pun di layar yang memberi tahu ada yang hilang.
   */
  const seluruhToko = (o: string) => `outlet_id.eq.${o},outlet_id.is.null`

  const [pl, exp, cf] = await Promise.all([
    scopedOutlet ? plQuery.eq('outlet_id', scopedOutlet) : plQuery,
    scopedOutlet ? expQuery.or(seluruhToko(scopedOutlet)) : expQuery,
    scopedOutlet ? cfQuery.or(seluruhToko(scopedOutlet)) : cfQuery,
  ])

  // Kegagalan query TIDAK boleh tampil sebagai angka nol. Nol berarti "tidak
  // ada transaksi"; gagal berarti "saya tidak bisa membacanya", dan di halaman
  // uang keduanya menuntut tindakan yang sangat berbeda.
  const gagal = pl.error ?? exp.error ?? cf.error
  if (gagal) {
    return (
      <>
        <LaporanTabs />
        <PageHeader
          eyebrow={session.org!.name}
          title="Laporan Keuangan"
          subtitle="Arus kas dan laba rugi dalam satu halaman."
        />
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            Laporan keuangan gagal dimuat, jadi angkanya belum bisa ditampilkan. Muat ulang
            halamannya; kalau masih sama, hubungi admin TokoKu. Tidak ada data yang hilang.
          </div>
        </div>
      </>
    )
  }

  const omzet = (pl.data ?? []).reduce((n, r) => n + Number(r.net_revenue), 0)
  const pajak = (pl.data ?? []).reduce((n, r) => n + Number(r.tax_collected), 0)
  const hpp = (pl.data ?? []).reduce((n, r) => n + Number(r.cogs), 0)
  const labaKotor = omzet - hpp
  const jumlahTrx = (pl.data ?? []).reduce((n, r) => n + Number(r.transaction_count), 0)

  const perKategori = [...(exp.data ?? [])
    .reduce((map, r) => {
      // Kolom view selalu bertipe nullable menurut generator tipe Supabase,
      // walau join-nya membuatnya mustahil null.
      const nama = r.category_name ?? 'Tanpa kategori'
      map.set(nama, (map.get(nama) ?? 0) + Number(r.amount))
      return map
    }, new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1])

  const totalPengeluaran = perKategori.reduce((n, [, v]) => n + v, 0)
  const labaBersih = labaKotor - totalPengeluaran

  const flows = (cf.data ?? []) as FlowRow[]
  const jumlah = (f: (r: FlowRow) => boolean) =>
    flows.filter(f).reduce((n, r) => n + Number(r.amount), 0)

  const kasMasukTunai = jumlah((r) => r.direction === 'masuk' && r.is_cash)
  const kasMasukNon = jumlah((r) => r.direction === 'masuk' && !r.is_cash)
  const kasKeluarBeli = jumlah((r) => r.direction === 'keluar' && r.source === 'pembelian')
  const kasKeluarBiaya = jumlah((r) => r.direction === 'keluar' && r.source === 'pengeluaran')
  const kasBersih = kasMasukTunai + kasMasukNon - kasKeluarBeli - kasKeluarBiaya

  // Per bulan, supaya "12 Bulan" tidak menjadi 365 baris. Untuk periode satu
  // bulan tabelnya tinggal satu baris, dan itu memang jawabannya.
  const perBulan = [...flows
    .reduce((map, r) => {
      const bulan = r.flow_date.slice(0, 7) + '-01'
      const b = map.get(bulan) ?? { masuk: 0, keluar: 0 }
      if (r.direction === 'masuk') b.masuk += Number(r.amount)
      else b.keluar += Number(r.amount)
      map.set(bulan, b)
      return map
    }, new Map<string, { masuk: number; keluar: number }>())
    .entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <>
      <LaporanTabs />
      <PageHeader
        eyebrow={session.org!.name}
        title="Laporan Keuangan"
        subtitle={
          multiOutlet && scopeName
            ? `${scopeName} · ${PERIODE_LABEL[aktif].toLowerCase()}`
            : PERIODE_LABEL[aktif].toLowerCase()
        }
        /* Dua pilihan dalam satu panel, bukan dua tombol. Laba rugi dan arus
           kas adalah dua buku yang menjawab pertanyaan berbeda, tapi orang
           mengunduh salah satunya, bukan keduanya sekaligus. */
        action={
          <ExportReportButton
            pilihan={[
              { jenis: 'laba-rugi', label: 'Laba rugi' },
              { jenis: 'arus-kas', label: 'Arus kas' },
            ]}
            dari={from}
            sampai={to}
            outlet={scopeParam}
          />
        }
      />

      {multiOutlet && (
        <div className="period-tabs" style={{ marginBottom: 10 }}>
          {session.outlets.map((o) => (
            <Link
              key={o.id}
              href={tautan(aktif, o.id)}
              className={cn('btn btn-sm', !allOutlets && o.id === scopedOutlet ? 'btn-dark' : 'btn-ghost')}
              style={{ textDecoration: 'none' }}
            >
              {o.name}
            </Link>
          ))}
          <Link
            href={tautan(aktif, ALL_OUTLETS)}
            className={cn('btn btn-sm', allOutlets ? 'btn-dark' : 'btn-ghost')}
            style={{ textDecoration: 'none' }}
          >
            Semua outlet
          </Link>
        </div>
      )}

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PERIODE.map((p) => (
          <Link
            key={p}
            href={tautan(p, scopeParam)}
            className={cn('btn btn-sm', p === aktif ? 'btn-dark' : 'btn-ghost')}
            style={{ textDecoration: 'none' }}
          >
            {PERIODE_LABEL[p]}
          </Link>
        ))}
      </div>

      {/* Laba BERSIH yang jadi angka besar, bukan omzet. Omzet besar dengan
          laba tipis adalah keadaan paling sering di warung, dan menaruh omzet
          di sini membuat orang merasa untung padahal tidak. */}
      <div className="hero">
        <div className="hero-label">Laba Bersih {PERIODE_LABEL[aktif]}</div>
        <div className="hero-num">{rupiah(labaBersih)}</div>
        <div className="hero-meta">
          <div>
            <b>{rupiah(omzet)}</b>
            <span>Omzet</span>
          </div>
          <div>
            <b>{rupiah(labaKotor)}</b>
            <span>Laba kotor</span>
          </div>
          <div>
            <b>{rupiah(totalPengeluaran)}</b>
            <span>Pengeluaran</span>
          </div>
        </div>
      </div>

      <h2 className="section-title">Laba Rugi</h2>
      <div className="table-card">
        <div className="fin-row">
          <span>Omzet</span>
          <strong>{rupiah(omzet)}</strong>
        </div>
        <div className="fin-row">
          <span>Harga pokok barang terjual</span>
          <strong>-{rupiah(hpp)}</strong>
        </div>
        <div className="fin-row is-sum">
          <span>Laba kotor</span>
          <strong>{rupiah(labaKotor)}</strong>
        </div>

        {perKategori.length === 0 ? (
          <div className="fin-row">
            <span style={{ color: 'var(--color-ink-soft)' }}>Belum ada pengeluaran dicatat</span>
            <strong>-{rupiah(0)}</strong>
          </div>
        ) : (
          perKategori.map(([nama, jml]) => (
            <div className="fin-row" key={nama}>
              <span>{nama}</span>
              <strong>-{rupiah(jml)}</strong>
            </div>
          ))
        )}

        <div className="fin-row is-total">
          <span>Laba bersih</span>
          <strong className={cn(labaBersih < 0 && 'is-neg')}>{rupiah(labaBersih)}</strong>
        </div>
      </div>

      {pajak > 0 && (
        <p className="field-hint" style={{ marginTop: 10 }}>
          Pajak terpungut {rupiah(pajak)} tidak dihitung sebagai omzet. Uang itu dipungut dari
          pembeli untuk disetor, bukan pendapatan toko.
        </p>
      )}

      <p className="field-hint" style={{ marginTop: 10 }}>
        Pembelian barang tidak muncul di sini. Yang dihitung harga pokok barang yang benar-benar
        terjual, jadi kulakan besar tidak membuat laporan ini terbaca rugi. Uang belanjanya ada di
        Arus Kas.
      </p>

      {/* Kalau ini tidak disebut, orang akan menjumlahkan laba tiap cabang dan
          mendapat angka yang berbeda dari "Semua outlet", lalu menyimpulkan
          salah satunya salah hitung. Padahal keduanya benar: biaya seluruh toko
          memang dibebankan penuh ke tiap cabang saat cabangnya dilihat
          sendiri-sendiri, dan dihitung sekali saat dilihat bersama. */}
      {multiOutlet && !allOutlets && (
        <p className="field-hint" style={{ marginTop: 6 }}>
          Pengeluaran yang dicatat untuk seluruh toko ikut dibebankan penuh ke cabang ini. Karena
          itu laba bersih tiap cabang kalau dijumlahkan tidak akan sama dengan laba bersih
          &quot;Semua outlet&quot;.
        </p>
      )}

      <h2 className="section-title">Arus Kas</h2>
      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="stat-val">{rupiah(kasMasukTunai)}</div>
          <div className="stat-label">Masuk tunai</div>
        </div>
        <div className="card stat">
          <div className="stat-val">{rupiah(kasMasukNon)}</div>
          <div className="stat-label">Masuk non-tunai</div>
        </div>
        <div className="card stat">
          <div className="stat-val">{rupiah(kasKeluarBeli + kasKeluarBiaya)}</div>
          <div className="stat-label">Uang keluar</div>
        </div>
        <div className="card stat">
          <div className="stat-val" style={kasBersih < 0 ? { color: 'var(--color-coral)' } : undefined}>
            {rupiah(kasBersih)}
          </div>
          <div className="stat-label">Arus kas bersih</div>
        </div>
      </div>

      <div className="table-card">
        <div className="fin-row">
          <span>Belanja barang</span>
          <strong>-{rupiah(kasKeluarBeli)}</strong>
        </div>
        <div className="fin-row">
          <span>Biaya operasional</span>
          <strong>-{rupiah(kasKeluarBiaya)}</strong>
        </div>
      </div>

      {perBulan.length > 1 && (
        <div className="table-card" style={{ marginTop: 14 }}>
          <div className="table-scroll">
            <table className="buy-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th>Masuk & keluar</th>
                  <th style={{ textAlign: 'right' }}>Bersih</th>
                </tr>
              </thead>
              <tbody>
                {perBulan.map(([bulan, v]) => (
                  <tr key={bulan}>
                    <td className="by-code">
                      <div className="cell-name">{namaBulan(bulan)}</div>
                    </td>
                    {/* Di ponsel sel ini turun jadi baris kedua yang redup, jadi
                        keterangannya ditaruh di sini dan TIDAK diulang sebagai
                        cell-sub — diulang, angka yang sama tampil dua kali
                        bertumpuk. */}
                    <td className="by-date">
                      Masuk {rupiah(v.masuk)} · Keluar {rupiah(v.keluar)}
                    </td>
                    <td className="by-total" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {rupiah(v.masuk - v.keluar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 10 }}>
        Nota tempo baru terhitung di sini pada tanggal dilunasi, bukan saat barangnya datang.
        {multiOutlet &&
          ' Pengeluaran yang dicatat untuk seluruh toko ikut terhitung di cakupan cabang mana pun.'}
      </p>

      <Link href="/laporan/pengeluaran" className="link-card" style={{ marginTop: 14 }}>
        <Icon name="sliders" size={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cell-name">Catat Pengeluaran</div>
          <div className="cell-sub">
            {jumlahTrx > 0 && totalPengeluaran === 0
              ? 'Belum ada biaya operasional dicatat, jadi laba bersih di atas masih sama dengan laba kotor.'
              : 'Sewa, listrik, gaji, dan biaya lain yang tidak menambah stok.'}
          </div>
        </div>
        <Icon name="chevronRight" size={14} />
      </Link>
    </>
  )
}
