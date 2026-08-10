'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'

const QUICK_CASH = [1000, 2000, 5000, 10000, 20000, 50000, 100000]

export function PaymentModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number
  onClose: () => void
  onConfirm: (method: 'cash' | 'qris', paid: number) => Promise<void>
}) {
  const [method, setMethod] = useState<'cash' | 'qris'>('qris')
  const [paid, setPaid] = useState(total)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = Math.max(paid - total, 0)
  const short = method === 'cash' && paid < total

  // Pembulatan ke atas ke kelipatan uang yang lazim dipegang pembeli.
  const suggestions = Array.from(
    new Set([total, ...QUICK_CASH.map((n) => Math.ceil(total / n) * n)]),
  )
    .filter((n) => n >= total)
    .sort((a, b) => a - b)
    .slice(0, 4)

  async function confirm() {
    if (short || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(method, method === 'cash' ? paid : total)
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
                setPaid(total)
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
                  min={total}
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
