'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'

const QUICK_CASH = [1000, 2000, 5000, 10000, 20000, 50000, 100000]

export function PaymentModal({
  total,
  discount = 0,
  discountLabel = 'Potongan',
  onClose,
  onConfirm,
  customerSlot,
  redeemSlot,
}: {
  /** Total belanja SEBELUM potongan. */
  total: number
  /** Potongan penukaran poin, dalam rupiah. */
  discount?: number
  discountLabel?: string
  onClose: () => void
  onConfirm: (method: 'cash' | 'qris', paid: number) => Promise<void>
  /**
   * Pemilih pelanggan. Ditaruh di layar bayar, bukan di keranjang: di sinilah
   * kasir bertanya "nomornya berapa?" sambil menunggu uang, dan di sini pula
   * layarnya sama di desktop maupun ponsel.
   */
  customerSlot?: React.ReactNode
  /**
   * Penukaran poin. Slot terpisah dari `customerSlot` supaya urutannya di layar
   * mengikuti urutan percakapan di kasir: pilih pembelinya dulu, baru poinnya
   * punya arti.
   */
  redeemSlot?: React.ReactNode
}) {
  const [method, setMethod] = useState<'cash' | 'qris'>('qris')
  const bayar = Math.max(total - discount, 0)
  const [paid, setPaid] = useState(bayar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Uang diterima ikut naik saat tagihannya berubah — tapi TIDAK ikut turun.
   *
   * Kasir menukar poin setelah mengetik uang yang sudah dipegangnya; menimpa
   * angka itu berarti kembaliannya salah hitung dan pembeli menerima uang
   * kurang. Yang perlu diikuti cuma keadaan "uang kurang", yang kalau
   * dibiarkan membuat tombol bayar mati tanpa sebab yang kelihatan.
   */
  useEffect(() => {
    setPaid((p) => (p < bayar ? bayar : p))
  }, [bayar])

  const change = Math.max(paid - bayar, 0)
  const short = method === 'cash' && paid < bayar

  // Pembulatan ke atas ke kelipatan uang yang lazim dipegang pembeli.
  const suggestions = Array.from(
    new Set([bayar, ...QUICK_CASH.map((n) => Math.ceil(bayar / n) * n)]),
  )
    .filter((n) => n >= bayar)
    .sort((a, b) => a - b)
    .slice(0, 4)

  async function confirm() {
    if (short || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(method, method === 'cash' ? paid : bayar)
      // Sukses: komponen ini di-unmount oleh induknya, jadi tidak perlu
      // mengembalikan busy ke false.
    } catch (e) {
      // Kegagalan apa pun HARUS terlihat kasir. Menggantung tombol di
      // "Menyimpan…" tanpa pesan adalah cara tercepat kehilangan penjualan:
      // kasir mengira sudah tersimpan, padahal tidak.
      setError(e instanceof Error ? e.message : 'Gagal menyimpan transaksi.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div className="modal show">
        <div className="modal-card">
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            Pilih Metode Pembayaran
          </div>
          <div className="cell-sub" style={{ marginBottom: 6 }}>
            Total tagihan {rupiah(total)}
          </div>

          {customerSlot && <div style={{ margin: '10px 0 12px' }}>{customerSlot}</div>}
          {redeemSlot && <div style={{ margin: '0 0 12px' }}>{redeemSlot}</div>}

          {discount > 0 && (
            <div className="pay-summary">
              <div className="kv">
                <span>{discountLabel}</span>
                <span style={{ color: 'var(--color-forest)' }}>-{rupiah(discount)}</span>
              </div>
              <div className="kv kv-strong">
                <span>Yang harus dibayar</span>
                <span>{rupiah(bayar)}</span>
              </div>
            </div>
          )}

          <div className="pay-methods">
            <button
              type="button"
              className={cn(method === 'qris' && 'active')}
              onClick={() => setMethod('qris')}
            >
              QRIS
            </button>
            <button
              type="button"
              className={cn(method === 'cash' && 'active')}
              onClick={() => {
                setMethod('cash')
                setPaid(bayar)
              }}
            >
              Tunai
            </button>
          </div>

          {method === 'cash' && (
            <>
              <div className="field">
                <label htmlFor="paid">Uang diterima</label>
                <input
                  id="paid"
                  type="number"
                  inputMode="numeric"
                  value={paid}
                  min={bayar}
                  onChange={(e) => setPaid(Number(e.target.value) || 0)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {suggestions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPaid(n)}
                  >
                    {rupiah(n)}
                  </button>
                ))}
              </div>
              <div className="kv" style={{ marginBottom: 12 }}>
                <span>Kembalian</span>
                <span style={{ color: short ? 'var(--color-coral)' : undefined }}>
                  {short ? 'Uang kurang' : rupiah(change)}
                </span>
              </div>
            </>
          )}

          {error && (
            <div className="empty-note" style={{ marginBottom: 12 }} role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={short || busy}
            onClick={confirm}
          >
            {busy ? 'Menyimpan…' : 'Konfirmasi Pembayaran'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 8 }}
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
        </div>
      </div>
    </>
  )
}
