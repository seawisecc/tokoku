'use client'

import { useState, useTransition } from 'react'
import { adjustStock, type ActionResult } from '@/app/(toko)/produk/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'

export type StockTarget = { id: string; name: string; sku: string; stock: number; unit: string }

/**
 * Penyesuaian stok (opname).
 *
 * Kasir mengisi jumlah hasil hitung fisik, bukan selisihnya — menghitung
 * selisih di kepala adalah sumber salah ketik. Selisihnya dihitung dan
 * ditampilkan di sini sebagai konfirmasi sebelum disimpan.
 */
export function StockDrawer({
  target,
  onClose,
  onSaved,
}: {
  target: StockTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const [qty, setQty] = useState(String(target?.stock ?? 0))
  const [note, setNote] = useState('')
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  if (!target) return null

  const parsed = Number(qty)
  const valid = Number.isInteger(parsed) && parsed >= 0
  const delta = valid ? parsed - target.stock : 0
  const err = result && !result.ok ? result : null

  function submit() {
    startTransition(async () => {
      const res = await adjustStock(target!.id, parsed, note.trim() || null)
      setResult(res)
      if (res.ok) onSaved()
    })
  }

  return (
    <Drawer
      open
      title="Penyesuaian Stok"
      subtitle={target.name}
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
            disabled={pending || !valid || delta === 0}
            onClick={submit}
          >
            {pending ? 'Menyimpan…' : 'Simpan Penyesuaian'}
          </button>
        </>
      }
    >
      <div className="mini-stat-row" style={{ marginBottom: 18 }}>
        <div className="mini-stat">
          <b>{target.stock}</b>
          <span>Stok tercatat</span>
        </div>
        <div className="mini-stat">
          <b style={{ color: delta === 0 ? undefined : delta > 0 ? 'var(--color-success)' : 'var(--color-coral)' }}>
            {delta > 0 ? `+${delta}` : delta}
          </b>
          <span>Selisih</span>
        </div>
        <div className="mini-stat">
          <b>{valid ? parsed : '—'}</b>
          <span>Jadi</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="qty">Hasil hitung fisik ({target.unit})</label>
        <input
          id="qty"
          type="number"
          min={0}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-invalid={!valid}
        />
        {!valid && <div className="field-error">Harus bilangan bulat, minimal 0.</div>}
      </div>

      <div className="field">
        <label htmlFor="note">Catatan</label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Mis. barang rusak, salah hitung, retur supplier"
        />
        <div className="field-hint">
          Tercatat permanen di buku besar stok — tulis sebab yang jelas agar bisa
          ditelusuri nanti.
        </div>
      </div>

      {err && (
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{err.error}</div>
        </div>
      )}
    </Drawer>
  )
}
