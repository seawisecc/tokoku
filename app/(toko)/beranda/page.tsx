import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { jam, rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Beranda | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function BerandaPage() {
  const session = await requirePermission('reports')
  const supabase = await createClient()
  const orgId = session.org!.id

  // Tanggal "hari ini" menurut zona waktu toko, bukan zona server Vercel.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })

  const [
    { data: sales },
    { count: productCount },
    { data: alerts },
    { data: recent },
    { count: teamCount },
    { data: dueSoon },
  ] = await Promise.all([
      // Disaring per OUTLET, dan `maybeSingle()` dibuang.
      //
      // `v_daily_sales` dikelompokkan per (organisasi, outlet, tanggal). Dengan
      // satu outlet kebetulan selalu tepat satu baris, jadi maybeSingle() aman.
      // Begitu dua cabang sama-sama berjualan hari ini, ia mengembalikan dua
      // baris dan PostgREST menjawab error — beranda, halaman pertama yang
      // dibuka pemilik toko tiap pagi, langsung gagal dimuat.
      //
      // Angkanya mengikuti outlet aktif di topbar, sama seperti seluruh
      // aplikasi. Untuk melihat gabungan semua cabang, ada Laporan.
      supabase
        .from('v_daily_sales')
        .select('revenue, transaction_count, avg_ticket, qris_count')
        .eq('organization_id', orgId)
        .eq('outlet_id', session.outletId!)
        .eq('sales_date', today)
        .limit(1),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null),
      // Peringatan stok juga per outlet. Tanpa saringan ini, pemilik yang sedang
      // membuka cabang A melihat daftar restock cabang B bercampur di dalamnya —
      // dan cabang yang baru dibuka (stok masih nol untuk semua produk) akan
      // membanjiri beranda cabang lama dengan puluhan peringatan palsu.
      supabase
        .from('v_stock_alert')
        .select('product_name, quantity, severity')
        .eq('organization_id', orgId)
        .eq('outlet_id', session.outletId!)
        .order('quantity'),
      supabase
        .from('transactions')
        .select('id, code, total, client_created_at, cashier_id, profiles:cashier_id(full_name)')
        .eq('organization_id', orgId)
        .eq('outlet_id', session.outletId!)
        .eq('status', 'paid')
        .order('client_created_at', { ascending: false })
        .limit(4),
      supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active'),
      // Tagihan tempo yang belum lunas. Dibatasi 14 hari ke depan supaya yang
      // muncul memang yang perlu disiapkan uangnya, bukan seluruh daftar hutang.
      supabase
        .from('purchases')
        .select('id, code, total, due_date, suppliers(name)')
        .eq('organization_id', orgId)
        .eq('payment', 'credit')
        .is('paid_at', null)
        .lte('due_date', new Date(Date.now() + 14 * 864e5).toLocaleDateString('en-CA'))
        .order('due_date')
        .limit(5),
    ])

  // Hanya disebut kalau memang ada lebih dari satu cabang — toko satu outlet
  // tidak perlu diberi tahu bahwa angkanya milik outletnya sendiri.
  const outletName =
    session.outlets.length > 1
      ? (session.outlets.find((o) => o.id === session.outletId)?.name ?? null)
      : null

  const today0 = sales?.[0]
  const revenue = today0?.revenue ?? 0
  const trxCount = today0?.transaction_count ?? 0
  const qrisShare = trxCount ? Math.round(((today0?.qris_count ?? 0) / trxCount) * 100) : 0
  const lowStock = alerts ?? []
  const bills = dueSoon ?? []
  const owed = bills.reduce((n, b) => n + Number(b.total ?? 0), 0)
  /**
 * Selisih HARI KALENDER, bukan selisih waktu.
 *
 * Memakai selisih jam lalu dibulatkan membuat nota yang jatuh tempo lusa
 * tertulis "3 hari lagi" — orang menghitung tanggal, bukan durasi.
 */
  const sisaHari = (due: string) => {
    const jatuh = new Date(due + 'T00:00:00').getTime()
    const kini = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
    return Math.round((jatuh - kini) / 864e5)
  }

  return (
    <>
      {/* Saat toko punya lebih dari satu cabang, seluruh angka di halaman ini
          milik cabang yang sedang dibuka — dan itu harus tertulis, bukan hanya
          tersirat dari pemilih di topbar. Angka omset yang tidak jelas miliknya
          siapa lebih buruk daripada tidak ada angka sama sekali. */}
      <PageHeader
        eyebrow={session.org!.name}
        title="Beranda"
        subtitle={
          outletName
            ? `Ringkasan ${outletName} hari ini.`
            : 'Ringkasan performa toko hari ini.'
        }
      />

      <div className="hero">
        <div className="hero-label">Omset Hari Ini</div>
        <div className="hero-num">{rupiah(revenue)}</div>
        <div className="hero-meta">
          <div>
            <b>{trxCount}</b>
            <span>Transaksi</span>
          </div>
          <div>
            <b>{rupiah(today0?.avg_ticket ?? 0)}</b>
            <span>Rata-rata/transaksi</span>
          </div>
          <div>
            <b>{qrisShare}%</b>
            <span>Lewat QRIS</span>
          </div>
        </div>
      </div>

      <div className="grid grid-stats">
        <Stat icon="box" bg="#EEF1EC" fg="#4B5A50" value={productCount ?? 0} label="Produk aktif" />
        <Stat
          icon="alert"
          bg="var(--color-coral-soft)"
          fg="var(--color-coral)"
          value={lowStock.length}
          label="Stok menipis"
        />
        <Stat
          icon="users"
          bg="var(--color-success-soft)"
          fg="var(--color-success)"
          value={teamCount ?? 0}
          label="Anggota tim"
        />
        <Stat
          icon="card"
          bg="var(--color-blue-soft)"
          fg="var(--color-blue-ink)"
          value={`${qrisShare}%`}
          label="Transaksi QRIS"
        />
      </div>

      {/* Tiga bagian di bawah ini dulunya menumpuk satu kolom penuh. Di monitor
          lebar hasilnya baris-baris pendek yang merentang seribu piksel — nomor
          transaksi di ujung kiri, nominalnya di ujung kanan, dan mata harus
          melompat jauh untuk memasangkannya. Disandingkan dua kolom, panjang
          barisnya kembali wajar. Di bawah 1100px semuanya menumpuk seperti
          semula. */}
      <div className="wide-cols lead-left">
        <div>
      {bills.length > 0 && (
        <>
          <div className="section-title">
            Tagihan Jatuh Tempo
            <Link href="/pembelian" className="link">
              Lihat semua <Icon name="chevronRight" size={13} />
            </Link>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bills.map((b) => {
              const sisa = sisaHari(b.due_date!)
              const telat = sisa < 0
              return (
                <div
                  className="empty-note"
                  key={b.id}
                  style={
                    telat
                      ? undefined
                      : { background: 'var(--color-amber-soft)', color: 'var(--color-amber-ink)' }
                  }
                >
                  <Icon name="alert" size={16} style={{ marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <b>{rupiah(Number(b.total ?? 0))}</b> ke{' '}
                    {(b.suppliers as unknown as { name: string } | null)?.name ?? 'pemasok'},{' '}
                    {telat
                      ? `telat ${Math.abs(sisa)} hari`
                      : sisa === 0
                        ? 'jatuh tempo hari ini'
                        : `${sisa} hari lagi`}
                    . Nota {b.code}.
                  </div>
                </div>
              )
            })}
            {bills.length > 1 && (
              <div className="field-hint" style={{ marginTop: 0 }}>
                Total yang perlu disiapkan: <b>{rupiah(owed)}</b>
              </div>
            )}
          </div>
        </>
      )}

      {lowStock.length > 0 && (
        <>
          <div className="section-title">Perlu Perhatian</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lowStock.map((p) => (
              <div className="empty-note" key={p.product_name}>
                <Icon name="alert" size={16} style={{ marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  {p.severity === 'negative' ? (
                    <>
                      {p.product_name} tercatat <b>{p.quantity}</b>. Stok minus, kemungkinan dari
                      transaksi offline yang baru tersinkron. Lakukan opname.
                    </>
                  ) : (
                    <>
                      {p.product_name} tersisa <b>{p.quantity}</b>. Pertimbangkan untuk restock.
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

        </div>

        <div>
      <div className="section-title">
        Transaksi Terbaru
        <Link href="/transaksi" className="link">
          Lihat semua <Icon name="chevronRight" size={13} />
        </Link>
      </div>
      <div className="table-card">
        {recent && recent.length > 0 ? (
          <div className="table-scroll">
            <table>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="cell-name mono" style={{ fontSize: 12 }}>
                        {t.code}
                      </div>
                      <div className="cell-sub">
                        {jam(t.client_created_at)} ·{' '}
                        {(t.profiles as { full_name: string } | null)?.full_name ?? 'Kasir'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupiah(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada transaksi hari ini.
          </div>
        )}
      </div>
        </div>
      </div>
    </>
  )
}

function Stat({
  icon,
  bg,
  fg,
  value,
  label,
}: {
  icon: 'box' | 'alert' | 'users' | 'card'
  bg: string
  fg: string
  value: React.ReactNode
  label: string
}) {
  return (
    <div className="card stat">
      <div className="stat-icon" style={{ background: bg, color: fg }}>
        <Icon name={icon} size={17} />
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
