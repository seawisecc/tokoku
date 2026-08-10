import Link from 'next/link'
import { cn } from '@/lib/format'
import { Icon } from '@/components/ui/icons'

export type TransactionRow = {
  id: string
  code: string
  time: string
  cashier: string
  method: string
  origin: string
  total: string
  /** 'paid' | 'void' | 'refunded' — lihat catatan pada badge di bawah. */
  status: string
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  other: 'Lainnya',
}

/**
 * Tabel transaksi — dipakai layar Transaksi (pemilik) dan Riwayat (kasir).
 * Kolom kasir disembunyikan di layar Riwayat karena semua barisnya milik
 * orang yang sama.
 */
export function TransactionTable({
  rows,
  showCashier = false,
}: {
  rows: TransactionRow[]
  showCashier?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="table-card">
        <div className="placeholder-card" style={{ border: 'none' }}>
          Belum ada transaksi.
        </div>
      </div>
    )
  }

  return (
    <div className="table-card">
      {/* `trx-table` menyusun ulang baris jadi tumpukan di layar sempit —
          lihat blok @media di globals.css. Nominal adalah alasannya: sebagai
          tabel biasa, kolom Total jatuh di luar layar 390px dan daftar
          transaksi kehilangan satu-satunya angka yang dicari orang. */}
      <div className="table-scroll">
        <table className="trx-table">
          <thead>
            <tr>
              <th>No. Transaksi</th>
              {showCashier && <th>Kasir</th>}
              <th>Metode</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              /* Transaksi yang DIBATALKAN wajib terlihat berbeda.
                 Sebelum ini `status` tidak pernah diambil dari database maupun
                 ditampilkan, sehingga transaksi void tampil persis seperti yang
                 sah — nominal penuh, tanpa penanda apa pun. Pemilik toko yang
                 menyusuri daftar ini menghitung uang yang tidak pernah masuk.
                 Nominalnya dicoret, bukan disembunyikan: barisnya tetap harus
                 ada supaya nomor transaksinya tidak terlihat hilang. */
              const voided = t.status === 'void'
              return (
              <tr key={t.id} style={voided ? { opacity: 0.6 } : undefined}>
                <td className="trx-code">
                  <Link href={`/transaksi/${t.id}`} className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                    {t.code}
                  </Link>
                  <div className="cell-sub">{t.time}</div>
                </td>
                {showCashier && <td className="trx-cashier">{t.cashier}</td>}
                <td className="trx-method">
                  {voided ? (
                    <span className="badge badge-low">Dibatalkan</span>
                  ) : (
                    <span className={cn('badge', t.method === 'qris' ? 'badge-growth' : 'badge-ok')}>
                      {METHOD_LABEL[t.method] ?? t.method}
                    </span>
                  )}
                  {t.origin === 'offline' && (
                    <span
                      className="badge badge-trial"
                      style={{ marginLeft: 6 }}
                      title="Dibuat saat perangkat offline, lalu tersinkron"
                    >
                      <Icon name="wifiOff" size={11} /> Offline
                    </span>
                  )}
                </td>
                <td
                  className="trx-total"
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    textDecoration: voided ? 'line-through' : undefined,
                  }}
                >
                  {t.total}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
