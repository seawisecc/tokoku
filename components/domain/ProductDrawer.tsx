'use client'

import { useState, useTransition } from 'react'
import { saveProduct, type ActionResult } from '@/app/(toko)/produk/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'

export type ProductFormValue = {
  id: string | null
  name: string
  sku: string
  barcode: string | null
  categoryId: string | null
  unit: string
  costPrice: number
  sellPrice: number
  minStock: number
  trackStock: boolean
}

/**
 * `defaultMinStock` datang dari `organizations.low_stock_threshold` — setelan
 * "Ambang Stok Menipis (bawaan)" di Pengaturan → Toko.
 *
 * Sebelum ini angkanya dipatok 10 di sini, sehingga setelan tokonya tersimpan
 * rapi ke database lalu tidak pernah dibaca oleh apa pun: pemilik toko
 * mengubahnya dan tidak ada yang berubah, padahal keterangan di bawah isiannya
 * sudah menjanjikan "Dipakai untuk produk baru".
 */
export const emptyProduct = (suggestedSku: string, defaultMinStock = 10): ProductFormValue => ({
  id: null,
  name: '',
  sku: suggestedSku,
  barcode: '',
  categoryId: null,
  unit: 'pcs',
  costPrice: 0,
  sellPrice: 0,
  minStock: defaultMinStock,
  trackStock: true,
})

type Draft = {
  name: string
  sku: string
  barcode: string
  categoryId: string
  unit: string
  costPrice: string
  sellPrice: string
  minStock: string
  trackStock: boolean
}

/** Field yang punya slot pesan sendiri di bawah input. */
const INLINE_FIELDS = ['name', 'sku', 'barcode', 'costPrice', 'sellPrice', 'minStock']

export function ProductDrawer({
  value,
  categories,
  onClose,
  onSaved,
}: {
  value: ProductFormValue | null
  categories: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  /**
   * Seluruh isian dipegang state, bukan `defaultValue`.
   *
   * React 19 me-reset <form> begitu `action`-nya selesai. Dengan input tak
   * terkendali, setiap kegagalan validasi menghapus semua yang sudah diketik —
   * pemilik toko mengisi sepuluh field, salah satu ditolak, dan harus mengetik
   * ulang semuanya. Dengan state, isian bertahan dan hanya pesan errornya
   * yang muncul.
   */
  const [draft, setDraft] = useState<Draft>(() => ({
    name: value?.name ?? '',
    sku: value?.sku ?? '',
    barcode: value?.barcode ?? '',
    categoryId: value?.categoryId ?? '',
    unit: value?.unit ?? 'pcs',
    costPrice: String(value?.costPrice ?? 0),
    sellPrice: String(value?.sellPrice ?? 0),
    minStock: String(value?.minStock ?? 10),
    trackStock: value?.trackStock ?? true,
  }))
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  if (!value) return null

  const set = <K extends keyof Draft>(key: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: v }))

  const isEdit = Boolean(value.id)
  const cost = Number(draft.costPrice || 0)
  const sell = Number(draft.sellPrice || 0)
  const margin = sell - cost
  const marginPct = sell > 0 ? Math.round((margin / sell) * 100) : 0

  const err = result && !result.ok ? result : null
  const showGeneral = Boolean(err && (!err.field || !INLINE_FIELDS.includes(err.field)))

  function submit() {
    const fd = new FormData()
    fd.set('name', draft.name)
    fd.set('sku', draft.sku)
    fd.set('barcode', draft.barcode)
    fd.set('categoryId', draft.categoryId)
    fd.set('unit', draft.unit)
    fd.set('costPrice', draft.costPrice)
    fd.set('sellPrice', draft.sellPrice)
    fd.set('minStock', draft.minStock)
    if (draft.trackStock) fd.set('trackStock', 'on')

    startTransition(async () => {
      const res = await saveProduct(value!.id, fd)
      setResult(res)
      if (res.ok) onSaved()
    })
  }

  return (
    <Drawer
      open
      title={isEdit ? 'Edit Produk' : 'Tambah Produk'}
      subtitle={isEdit ? value.sku : 'Produk baru'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-dark"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={pending}
            onClick={submit}
          >
            {pending ? 'Menyimpan…' : 'Simpan Produk'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="name">Nama Produk</label>
        <input
          id="name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Minyak Goreng Sania 2L"
          aria-invalid={err?.field === 'name'}
        />
        {err?.field === 'name' && <div className="field-error">{err.error}</div>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="categoryId">Kategori</label>
          <select
            id="categoryId"
            value={draft.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
          >
            <option value="">— Tanpa kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sku">SKU</label>
          <input
            id="sku"
            value={draft.sku}
            onChange={(e) => set('sku', e.target.value.toUpperCase())}
            aria-invalid={err?.field === 'sku'}
          />
          {err?.field === 'sku' && <div className="field-error">{err.error}</div>}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="costPrice">Harga Pokok</label>
          <input
            id="costPrice"
            inputMode="numeric"
            value={draft.costPrice}
            onChange={(e) => set('costPrice', e.target.value.replace(/[^\d]/g, ''))}
            aria-invalid={err?.field === 'costPrice'}
          />
          <div className="field-hint">{rupiah(cost)}</div>
          {err?.field === 'costPrice' && <div className="field-error">{err.error}</div>}
        </div>
        <div className="field">
          <label htmlFor="sellPrice">Harga Jual</label>
          <input
            id="sellPrice"
            inputMode="numeric"
            value={draft.sellPrice}
            onChange={(e) => set('sellPrice', e.target.value.replace(/[^\d]/g, ''))}
            aria-invalid={err?.field === 'sellPrice'}
          />
          <div className="field-hint">{rupiah(sell)}</div>
          {err?.field === 'sellPrice' && <div className="field-error">{err.error}</div>}
        </div>
      </div>

      {sell > 0 && (
        <div
          className="kv"
          style={{
            marginBottom: 14,
            borderBottom: 'none',
            background: 'var(--color-paper)',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          <span>Margin per unit</span>
          <span style={{ color: margin < 0 ? 'var(--color-coral)' : 'var(--color-success)' }}>
            {rupiah(margin)} ({marginPct}%)
          </span>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="unit">Satuan</label>
          <input
            id="unit"
            value={draft.unit}
            onChange={(e) => set('unit', e.target.value)}
            placeholder="pcs"
          />
        </div>
        <div className="field">
          <label htmlFor="minStock">Ambang Stok Menipis</label>
          <input
            id="minStock"
            type="number"
            min={0}
            value={draft.minStock}
            onChange={(e) => set('minStock', e.target.value)}
            aria-invalid={err?.field === 'minStock'}
          />
          <div className="field-hint">Muncul di Beranda kalau stok ≤ angka ini</div>
          {err?.field === 'minStock' && <div className="field-error">{err.error}</div>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="barcode">Barcode</label>
        <input
          id="barcode"
          value={draft.barcode}
          onChange={(e) => set('barcode', e.target.value)}
          placeholder="Opsional — untuk pemindai"
          aria-invalid={err?.field === 'barcode'}
        />
        {err?.field === 'barcode' && <div className="field-error">{err.error}</div>}
      </div>

      <label
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '10px 0',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Lacak stok</span>
        <input
          type="checkbox"
          checked={draft.trackStock}
          onChange={(e) => set('trackStock', e.target.checked)}
        />
      </label>
      <div className="field-hint" style={{ marginBottom: 14 }}>
        Matikan untuk jasa atau produk tanpa persediaan.
      </div>

      {showGeneral && err && (
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{err.error}</div>
        </div>
      )}

      {isEdit && (
        <p className="field-hint">
          Stok tidak diubah dari sini — pakai tombol penyesuaian stok di baris produk,
          supaya setiap perubahan tercatat di buku besar stok.
        </p>
      )}
    </Drawer>
  )
}
