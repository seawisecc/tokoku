import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { LaporanTabs } from '@/components/domain/LaporanTabs'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn, rupiah, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Laporan Shift | TokoKu' }
export const dynamic = 'force-dynamic'

const PERIODS = [
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
]

const jam = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Makassar',
      })
    : '-'

/**
 * Laporan shift.
 *
 * Pertanyaan yang dijawab halaman ini adalah pertanyaan yang paling sering
 * ditanyakan pemilik warung: kemarin kasir siapa, jualannya berapa, dan uang di
 * laci cocok atau tidak. Datanya sudah ada sejak awal — shift, kas awal, kas
 * seharusnya, kas fisik — tapi belum pernah ditampilkan di mana pun.
 *
 * Selisih kas ditonjolkan karena itu satu-satunya angka di sini yang menuntut
 * tindakan. Nol tidak diberi warna: memberi warna pada keadaan normal membuat
 * mata berhenti membedakan mana yang perlu dilihat.
 */
export default async function LaporanShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const session = await requirePermission('reports')
  const { periode } = await searchParams
  const days = PERIODS.some((p) => String(p.days) === periode) ? Number(periode) : 7

  const supabase = await createClient()
  const since = new Date(Date.now() - days * 864e5).toISOString()

  // Disaring per outlet aktif. Shift adalah kejadian di SATU meja kasir di SATU
  // cabang; menggabungkannya lintas cabang membuat "kasir siapa yang jaga" dan
  // "uang di laci cocok atau tidak" — dua pertanyaan yang dijawab halaman ini —
  // kehilangan tempatnya.
  const { data: shifts } = await supabase
    .from('v_shift_summary')
    .select('*')
    .eq('organization_id', session.org!.id)
    .eq('outlet_id', session.outletId!)
    .gte('opened_at', since)
    .order('opened_at', { ascending: false })

  const rows = shifts ?? []
  const closed = rows.filter((s) => s.status === 'closed')
  const totalSales = rows.reduce((n, s) => n + Number(s.sales_total ?? 0), 0)
  const totalTrx = rows.reduce((n, s) => n + Number(s.trx_count ?? 0), 0)
  // Hanya shift tertutup yang punya selisih. Shift berjalan belum dihitung
  // kasnya, jadi memasukkannya sebagai "0" akan menyamarkan masalah nyata.
  const mismatched = closed.filter((s) => Number(s.cash_difference ?? 0) !== 0)
  const totalGap = mismatched.reduce((n, s) => n + Number(s.cash_difference ?? 0), 0)

  return (
    <>
      <LaporanTabs />
      <PageHeader
        eyebrow={
          <Link href="/laporan" style={{ color: 'inherit' }}>
            ← Laporan
          </Link>
        }
        title="Laporan Shift"
        subtitle="Siapa yang berjaga, berapa penjualannya, dan apakah uang di laci cocok."
      />

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/laporan/shift?periode=${p.days}`}
            className={cn('btn btn-sm', p.days === days ? 'btn-dark' : 'btn-ghost')}
            style={{ textDecoration: 'none' }}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 18 }}>
        <div className="card stat">
          <div className="stat-val">{rows.length}</div>
          <div className="stat-label">Shift</div>
        </div>
        <div className="card stat">
          <div className="stat-val">{totalTrx}</div>
          <div className="stat-label">Transaksi</div>
        </div>
        <div className="card stat">
          <div className="stat-val">{rupiah(totalSales)}</div>
          <div className="stat-label">Penjualan</div>
        </div>
        <div className="card stat">
          <div
            className="stat-val"
            style={mismatched.length > 0 ? { color: 'var(--color-coral)' } : undefined}
          >
            {mismatched.length}
          </div>
          <div className="stat-label">
            Shift selisih kas
            {mismatched.length > 0 && ` · ${rupiah(totalGap)}`}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="placeholder-card">
          Belum ada shift dalam {days} hari terakhir. Shift dibuka otomatis saat kasir membuka
          halaman Kasir.
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="shift-table">
              <thead>
                <tr>
                  <th>Kasir</th>
                  <th>Waktu</th>
                  <th>Transaksi</th>
                  <th style={{ textAlign: 'right' }}>Tunai</th>
                  <th style={{ textAlign: 'right' }}>Non-tunai</th>
                  <th style={{ textAlign: 'right' }}>Selisih Kas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const open = s.status === 'open'
                  const gap = Number(s.cash_difference ?? 0)
                  return (
                    <tr key={s.id}>
                      <td className="sh-who">
                        <div className="cell-name">{s.cashier_name ?? 'Kasir'}</div>
                        <div className="cell-sub">
                          {tanggal(s.opened_at)}
                          {s.device_code ? ` · ${s.device_code}` : ''}
                        </div>
                      </td>
                      <td className="sh-time">
                        {jam(s.opened_at)} – {open ? 'berjalan' : jam(s.closed_at)}
                        {open && (
                          <span className="badge badge-trial" style={{ marginLeft: 8 }}>
                            Berjalan
                          </span>
                        )}
                      </td>
                      <td className="sh-trx">
                        {s.trx_count ?? 0}
                        {Number(s.void_count ?? 0) > 0 && (
                          <span className="cell-sub"> · {s.void_count} batal</span>
                        )}
                      </td>
                      <td className="sh-cash" style={{ textAlign: 'right' }}>
                        {rupiah(Number(s.cash_total ?? 0))}
                      </td>
                      <td className="sh-noncash" style={{ textAlign: 'right' }}>
                        {rupiah(Number(s.noncash_total ?? 0))}
                      </td>
                      <td className="sh-gap" style={{ textAlign: 'right' }}>
                        {open ? (
                          <span style={{ color: 'var(--color-ink-faint)' }}>-</span>
                        ) : gap === 0 ? (
                          <span style={{ color: 'var(--color-ink-faint)' }}>Cocok</span>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-coral)',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Icon name="alert" size={12} style={{ marginRight: 4 }} />
                            {/* Tandanya ditaruh di depan "Rp" untuk kedua arah.
                                Membiarkan yang minus jadi "Rp -1.000" sementara
                                yang plus "+Rp 25.000" membuat dua angka yang
                                harus dibandingkan terbaca beda bentuk. */}
                            {gap > 0 ? '+' : '−'}
                            {rupiah(Math.abs(gap))}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 12 }}>
        Selisih kas = uang fisik yang dihitung kasir dikurangi kas yang seharusnya (kas awal +
        penjualan tunai). Angka minus berarti uang kurang, plus berarti lebih. Keduanya sama-sama
        perlu ditanyakan.
      </p>
    </>
  )
}
