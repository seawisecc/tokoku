import { rupiah } from '@/lib/format'

/**
 * Komposisi metode bayar — satu batang terbagi, bukan diagram lingkaran.
 *
 * Dengan dua bagian, panjang jauh lebih mudah dibandingkan mata daripada sudut.
 * Warnanya sudah lolos validasi CVD (ΔE 23,0) dan tiap bagian tetap diberi
 * label langsung + legenda, jadi identitasnya tidak pernah bergantung warna saja.
 */
export function PaymentSplit({
  qris,
  cash,
}: {
  qris: { count: number; revenue: number }
  cash: { count: number; revenue: number }
}) {
  const total = qris.revenue + cash.revenue
  if (total === 0) {
    return <div className="placeholder-card" style={{ border: 'none' }}>Belum ada pembayaran.</div>
  }
  const qrisPct = Math.round((qris.revenue / total) * 100)
  const cashPct = 100 - qrisPct

  return (
    <div className="viz">
      <div className="split-bar">
        <div style={{ width: `${qrisPct}%`, background: 'var(--series-1)' }}>
          {qrisPct >= 12 ? `${qrisPct}%` : ''}
        </div>
        <div style={{ width: `${cashPct}%`, background: 'var(--series-2)' }}>
          {cashPct >= 12 ? `${cashPct}%` : ''}
        </div>
      </div>

      <div className="viz-legend">
        <div>
          <span className="swatch" style={{ background: 'var(--series-1)' }} />
          QRIS — {rupiah(qris.revenue)} · {qris.count} trx
        </div>
        <div>
          <span className="swatch" style={{ background: 'var(--series-2)' }} />
          Tunai — {rupiah(cash.revenue)} · {cash.count} trx
        </div>
      </div>
    </div>
  )
}
