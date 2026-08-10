'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePurchase } from '@/app/(toko)/pembelian/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'

export type PickProduct = {
  id: string
  name: string
  sku: string
  unit: string
  costPrice: number
}

export type PickSupplier = { id: string; name: string }

type Line = { productId: string; quantity: string; unitCost: string }

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })

/**
 * Form pembelian.
 *
 * Semua input terkendali state — React 19 mengosongkan <form> setiap kali
 * action selesai, dan kehilangan sepuluh baris barang karena satu validasi
 * gagal adalah cara tercepat membuat orang berhenti memakai fitur ini.
 */
export function PurchaseDrawer({
  products,
  suppliers,
  canUseSupplier,
  onClose,
}: {
  products: PickProduct[]
  suppliers: PickSupplier[]
  /** Pemasok & tempo hanya untuk paket Growth ke atas. */
  canUseSupplier: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(today())
  const [payment, setPayment] = useState<'paid' | 'credit'>('paid')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '1', unitCost: '' }])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const total = lines.reduce(
    (n, l) => n + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
    0,
  )

  function setLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function pickProduct(i: number, productId: string) {
    // Harga beli terakhir dipakai sebagai tebakan awal — paling sering memang
    // itu angkanya, dan kasir tinggal mengubah kalau harganya bergerak.
    const p = byId.get(productId)
    setLine(i, { productId, unitCost: p ? String(p.costPrice) : '' })
  }

  function submit() {
    setError(null)
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost) || 0,
      }))

    if (items.length === 0) {
      setError('Tambahkan minimal satu barang beserta jumlahnya.')
      return
    }

    const fd = new FormData()
    fd.set('items', JSON.stringify(items))
    fd.set('supplierId', canUseSupplier ? supplierId : '')
    fd.set('invoiceNo', invoiceNo)
    fd.set('purchasedAt', purchasedAt)
    fd.set('payment', canUseSupplier ? payment : 'paid')
    fd.set('dueDate', canUseSupplier && payment === 'credit' ? dueDate : '')
    fd.set('note', note)

    startTransition(async () => {
      const res = await savePurchase(fd)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Drawer
      open
      title="Catat Pembelian"
      subtitle="Stok langsung bertambah dan harga pokok ikut diperbarui."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            type="button"
            disabled={pending}
            onClick={submit}
          >
            {pending ? 'Menyimpan…' : `Simpan · ${rupiah(total)}`}
          </button>
        </>
      }
    >
      {error && (
        <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="purchasedAt">Tanggal</label>
          <input
            id="purchasedAt"
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="invoiceNo">No. Nota</label>
          <input
            id="invoiceNo"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="Opsional"
          />
        </div>
      </div>

      {canUseSupplier && (
        <div className="field">
          <label htmlFor="supplierId">Pemasok</label>
          <select
            id="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">— Tanpa pemasok</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="field-hint">Tambah pemasok baru lewat halaman Pembelian.</div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 6 }}>
        Barang
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => setLines((c) => [...c, { productId: '', quantity: '1', unitCost: '' }])}
        >
          <Icon name="plus" size={13} /> Baris
        </button>
      </div>

      {lines.map((l, i) => {
        const p = byId.get(l.productId)
        return (
          <div className="buy-line" key={i}>
            <div className="field" style={{ marginBottom: 8 }}>
              <select value={l.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">— Pilih produk</option>
                {products.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="buy-line-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Jumlah {p ? `(${p.unit})` : ''}</label>
                <input
                  inputMode="numeric"
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value.replace(/[^\d]/g, '') })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Harga beli / satuan</label>
                <input
                  inputMode="numeric"
                  value={l.unitCost}
                  onChange={(e) => setLine(i, { unitCost: e.target.value.replace(/[^\d]/g, '') })}
                />
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="icon-action danger"
                  aria-label="Hapus baris"
                  onClick={() => setLines((c) => c.filter((_, idx) => idx !== i))}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            {p && Number(l.unitCost) > 0 && Number(l.unitCost) !== p.costPrice && (
              <div className="field-hint">
                Harga pokok akan berubah dari {rupiah(p.costPrice)} jadi{' '}
                {rupiah(Number(l.unitCost))}.
              </div>
            )}
          </div>
        )
      })}

      {canUseSupplier && (
        <>
          <div className="section-title">Pembayaran</div>
          <div className="pay-methods" style={{ margin: '0 0 12px' }}>
            <button
              type="button"
              className={cn(payment === 'paid' && 'active')}
              onClick={() => setPayment('paid')}
            >
              Lunas
            </button>
            <button
              type="button"
              className={cn(payment === 'credit' && 'active')}
              onClick={() => setPayment('credit')}
            >
              Tempo
            </button>
          </div>
          {payment === 'credit' && (
            <div className="field">
              <label htmlFor="dueDate">Jatuh tempo</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="field-hint">Muncul sebagai pengingat di Beranda.</div>
            </div>
          )}
        </>
      )}

      <div className="field">
        <label htmlFor="note">Catatan</label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opsional"
        />
      </div>
    </Drawer>
  )
}
