'use client'

import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import type { CartLine } from '@/lib/stores/cart'

export function CartPanel({
  lines,
  total,
  ready,
  notReadyLabel = 'Menyiapkan perangkat…',
  onQty,
  onClear,
  onPay,
}: {
  lines: CartLine[]
  total: number
  /** false selama perangkat POS belum terdaftar. */
  ready: boolean
  /** Bunyi tombol saat belum siap — harus jujur soal penyebabnya. */
  notReadyLabel?: string
  onQty: (productId: string, delta: number) => void
  onClear: () => void
  onPay: () => void
}) {
  return (
    /* id dipakai CartBar untuk melompat ke sini di layar sempit. */
    <div className="cart-panel" id="keranjang">
      <div className="cart-head">
        <span>Keranjang</span>
        {lines.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-coral)',
            }}
          >
            Kosongkan
          </button>
        ) : (
          <Icon name="cart" size={17} />
        )}
      </div>

      <div className="cart-items">
        {lines.length === 0 ? (
          <div className="cart-empty">Belum ada produk dipilih.</div>
        ) : (
          lines.map((l) => (
            <div className="cart-row" key={l.productId}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ci-name">{l.name}</div>
                <div className="ci-price">
                  {rupiah(l.price)} × {l.qty} = {rupiah(l.price * l.qty)}
                </div>
              </div>
              <div className="qty">
                <button type="button" onClick={() => onQty(l.productId, -1)} aria-label="Kurangi">
                  <Icon name="minus" size={13} />
                </button>
                <span>{l.qty}</span>
                <button type="button" onClick={() => onQty(l.productId, 1)} aria-label="Tambah">
                  <Icon name="plus" size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cart-total">
        <div className="row">
          <span>Subtotal</span>
          <span>{rupiah(total)}</span>
        </div>
        <div className="row total">
          <span>Total</span>
          <span>{rupiah(total)}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={lines.length === 0 || !ready}
          onClick={onPay}
        >
          {ready ? 'Bayar' : notReadyLabel}
        </button>
      </div>
    </div>
  )
}
