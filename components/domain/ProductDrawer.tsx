'use client'

import { useState, useTransition } from 'react'
import { saveProduct, type ActionResult } from '@/app/(toko)/produk/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { BarcodeScanner } from '@/components/pos/BarcodeScanner'
import { Icon } from '@/components/ui/icons'
import { NumberField } from '@/components/ui/NumberField'
import { cn, rupiah } from '@/lib/format'

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
  promoPrice: number | null
  promoStartsAt: string | null
  promoEndsAt: string | null
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
  promoPrice: null,
  promoStartsAt: null,
  promoEndsAt: null,
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
  promoPrice: string
  promoStartsAt: string
  promoEndsAt: string
}

/** Field yang punya slot pesan sendiri di bawah input. */
const INLINE_FIELDS = ['name', 'sku', 'barcode', 'costPrice', 'sellPrice', 'minStock', 'promoPrice', 'promoEndsAt']

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
    promoPrice: value?.promoPrice != null ? String(value.promoPrice) : '',
    promoStartsAt: value?.promoStartsAt ?? '',
    promoEndsAt: value?.promoEndsAt ?? '',
  }))
  const [result, setResult] = useState<ActionResult | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!value) return null

  const set = <K extends keyof Draft>(key: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: v }))

  const isEdit = Boolean(value.id)
  const cost = Number(draft.costPrice || 0)
  const sell = Number(draft.sellPrice || 0)
  const margin = sell - cost
  const promo = Number(draft.promoPrice || 0)
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
    fd.set('promoPrice', draft.promoPrice)
    fd.set('promoStartsAt', draft.promoStartsAt)
    fd.set('promoEndsAt', draft.promoEndsAt)

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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-dark"
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
            <option value="">Tanpa kategori</option>
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
          <NumberField
            id="costPrice"
            value={draft.costPrice}
            onChange={(d) => set('costPrice', d)}
            invalid={err?.field === 'costPrice'}
          />
          {err?.field === 'costPrice' && <div className="field-error">{err.error}</div>}
        </div>
        <div className="field">
          <label htmlFor="sellPrice">Harga Jual</label>
          <NumberField
            id="sellPrice"
            value={draft.sellPrice}
            onChange={(d) => set('sellPrice', d)}
            invalid={err?.field === 'sellPrice'}
          />
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

      {/* Harga promo. Ditaruh tepat di bawah harga jual karena itu yang
          dibandingkan orang saat mengisinya, bukan di bagian lain halaman.
          Server yang memilih harga mana yang dipakai (lihat `effective_price`
          di v_product_stock), jadi kasir tidak punya pilihan sama sekali —
          itulah yang membuat lapis promo aman tanpa batas apa pun. */}
      <div className="field">
        <label htmlFor="promoPrice">Harga Promo (opsional)</label>
        <NumberField
          id="promoPrice"
          value={draft.promoPrice}
          onChange={(d) => set('promoPrice', d)}
          placeholder="Kosongkan kalau tidak sedang promo"
          invalid={err?.field === 'promoPrice'}
        />
        {err?.field === 'promoPrice' && <div className="field-error">{err.error}</div>}
        {promo > 0 && (
          <div className="field-hint">
            {rupiah(promo)}
            {sell > 0 && promo < sell ? ` · hemat ${rupiah(sell - promo)} (${Math.round(((sell - promo) / sell) * 100)}%)` : ''}
          </div>
        )}
        {promo > 0 && sell > 0 && promo >= sell && (
          <div className="field-error">
            Harga promo tidak lebih murah dari harga jual. Periksa lagi angkanya.
          </div>
        )}
      </div>

      {promo > 0 && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="promoStartsAt">Promo mulai</label>
            <input
              id="promoStartsAt"
              type="date"
              value={draft.promoStartsAt}
              onChange={(e) => set('promoStartsAt', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="promoEndsAt">Promo sampai</label>
            <input
              id="promoEndsAt"
              type="date"
              value={draft.promoEndsAt}
              onChange={(e) => set('promoEndsAt', e.target.value)}
              aria-invalid={err?.field === 'promoEndsAt'}
            />
            {err?.field === 'promoEndsAt' && <div className="field-error">{err.error}</div>}
          </div>
        </div>
      )}
      {promo > 0 && (
        <div className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
          Kosongkan tanggalnya untuk promo tanpa batas waktu. Berlaku sepanjang hari
          yang dipilih.
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
        {/* Ambang stok tidak punya arti untuk jasa: stoknya memang tidak
            pernah dicatat, jadi peringatan "menipis" tidak akan pernah muncul
            berapa pun angkanya. Isian yang tidak berpengaruh apa-apa membuat
            orang menebak-nebak apakah dia salah mengisi. */}
        {draft.trackStock && (
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
        )}
      </div>

      <div className="field">
        <label htmlFor="barcode">Barcode</label>
        {/* Diketik ATAU dipindai. Mengetik 13 angka dari kemasan sambil melihat
            bolak-balik adalah cara paling gampang salah satu digit, dan barcode
            yang salah satu digit tidak akan pernah ketemu saat dipindai di
            kasir — gagal yang baru ketahuan berminggu-minggu kemudian. */}
        <div className="scan-row" style={{ marginBottom: 0 }}>
          <div className="tf-input" style={{ flex: 1, minWidth: 0 }}>
            <input
              id="barcode"
              value={draft.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              placeholder="Ketik atau pindai"
              aria-invalid={err?.field === 'barcode'}
              inputMode="numeric"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost scan-btn"
            onClick={() => setScannerOpen(true)}
            aria-label="Pindai barcode dengan kamera"
            title="Pindai barcode dengan kamera"
          >
            <Icon name="scan" size={17} />
          </button>
        </div>
        <div className="field-hint">
          Dipakai kasir untuk memanggil produk ini dengan sekali pindai.
        </div>
        {err?.field === 'barcode' && <div className="field-error">{err.error}</div>}
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onScan={(kode) => {
            set('barcode', kode)
            return true
          }}
        />
      )}

      {/* Dulu ini sakelar bernama "Lacak stok" dengan keterangan kecil
          "Matikan untuk jasa". Kemampuannya sudah persis sama sejak awal —
          yang salah cuma cara bertanyanya. Pemilik warung tidak berpikir
          "saya mau mematikan pelacakan stok"; dia berpikir "yang ini jasa".
          Ditanya memakai istilah teknis, fiturnya ada tapi tidak pernah
          ditemukan. Dua pilihan tegas memakai `.pay-methods`, pola segmented
          yang sudah dipakai memilih metode bayar. */}
      <div className="field">
        <label>Jenis</label>
        <div className="pay-methods" style={{ margin: '0 0 6px' }}>
          <button
            type="button"
            className={cn(draft.trackStock && 'active')}
            onClick={() => set('trackStock', true)}
          >
            Barang
          </button>
          <button
            type="button"
            className={cn(!draft.trackStock && 'active')}
            onClick={() => set('trackStock', false)}
          >
            Jasa
          </button>
        </div>
        <div className="field-hint">
          {draft.trackStock
            ? 'Stoknya dihitung, berkurang tiap terjual, dan diperingatkan saat menipis.'
            : 'Tanpa stok: bisa dijual berapa kali pun. Untuk jasa seperti potong rambut, isi pulsa, atau ongkos antar.'}
        </div>
      </div>

      {showGeneral && err && (
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{err.error}</div>
        </div>
      )}

      {isEdit && (
        <p className="field-hint">
          Stok tidak diubah dari sini. Pakai tombol penyesuaian stok di baris produk,
          supaya setiap perubahan tercatat di buku besar stok.
        </p>
      )}
    </Drawer>
  )
}
