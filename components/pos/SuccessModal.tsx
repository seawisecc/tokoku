'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import type { OutboxTransaction } from '@/lib/offline/db'
import { Receipt, type ReceiptData } from './Receipt'
import { SendReceiptButton } from '@/components/domain/SendReceiptButton'

export type StoreInfo = {
  name: string
  outletName: string | null
  /** null kalau belum ada logo ATAU sakelar "Tampilkan logo" dimatikan. */
  logoUrl: string | null
  address: string | null
  phone: string | null
  receiptFooter: string | null
}

export function SuccessModal({
  trx,
  store,
  online,
  onClose,
}: {
  trx: OutboxTransaction
  store: StoreInfo
  online: boolean
  onClose: () => void
}) {
  const [showReceipt, setShowReceipt] = useState(false)
  const change = Math.max(trx.paid_amount - trx.total, 0)

  const receipt: ReceiptData = {
    code: trx.code,
    storeName: store.name,
    logoUrl: store.logoUrl,
    storeAddress: store.address,
    storePhone: store.phone,
    outletName: store.outletName,
    cashierName: trx.cashier_name,
    at: trx.client_created_at,
    paymentMethod: trx.payment_method,
    items: trx.items.map((i) => ({
      name: i.product_name,
      qty: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.unit_price * i.quantity - i.discount,
    })),
    subtotal: trx.items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    total: trx.total,
    paid: trx.paid_amount,
    change,
    footer: store.receiptFooter,
    offline: trx.origin === 'offline',
  }

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div className="modal show">
        <div className="modal-card success-wrap">
          <div className="success-circle">
            <Icon name="check" size={30} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Transaksi Selesai!</div>
          <div className="cell-sub" style={{ margin: '4px 0 14px' }}>
            <span className="mono">{trx.code}</span>
          </div>

          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <div className="kv">
              <span>Total</span>
              <span>{rupiah(trx.total)}</span>
            </div>
            {trx.payment_method === 'cash' && (
              <>
                <div className="kv">
                  <span>Uang diterima</span>
                  <span>{rupiah(trx.paid_amount)}</span>
                </div>
                <div className="kv">
                  <span>Kembalian</span>
                  <span>{rupiah(change)}</span>
                </div>
              </>
            )}
            <div className="kv">
              <span>Metode</span>
              <span>{trx.payment_method === 'qris' ? 'QRIS' : 'Tunai'}</span>
            </div>
          </div>

          {!online && (
            <div
              className="empty-note"
              style={{
                textAlign: 'left',
                marginBottom: 14,
                background: 'var(--color-amber-soft)',
                color: 'var(--color-amber-ink)',
              }}
            >
              <Icon name="wifiOff" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                Tersimpan di perangkat. Akan terkirim otomatis saat internet kembali.
                Struk ini tetap sah.
              </div>
            </div>
          )}

          {showReceipt && (
            <div className="receipt-preview" style={{ marginBottom: 14 }}>
              <Receipt data={receipt} />
            </div>
          )}

          {/* Di sinilah nota paling berguna dikirim: pembelinya masih berdiri
              di depan kasir dan nomornya bisa ditanyakan langsung. Di halaman
              detail transaksi tombolnya tetap ada, untuk yang baru diminta
              belakangan. */}
          <div style={{ marginBottom: 10 }}>
            <SendReceiptButton
              // Terisi otomatis dari pelanggan yang tadi dipilih di layar bayar.
              // Kasir tidak perlu menanyakan nomor yang sudah ada di database.
              customerName={trx.customer_name}
              customerPhone={trx.customer_phone}
              data={{
                storeName: store.name,
                storeAddress: store.address,
                storePhone: store.phone,
                outletName: store.outletName,
                code: trx.code,
                at: trx.client_created_at,
                cashierName: trx.cashier_name,
                items: receipt.items,
                subtotal: receipt.subtotal,
                total: trx.total,
                paid: trx.paid_amount,
                change,
                paymentMethod: trx.payment_method,
                footer: store.receiptFooter,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                // Pratinjau dulu supaya elemen struk ada di DOM sebelum dicetak;
                // aturan @media print hanya menampilkan .receipt.
                if (!showReceipt) {
                  setShowReceipt(true)
                  setTimeout(() => window.print(), 100)
                } else {
                  window.print()
                }
              }}
            >
              <Icon name="printer" size={15} /> Cetak
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
