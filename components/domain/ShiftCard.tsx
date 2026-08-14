'use client'

import { useState } from 'react'
import { closeShift } from '@/app/(toko)/shift/actions'
import { Icon } from '@/components/ui/icons'
import { NumberField } from '@/components/ui/NumberField'
import { jam, rupiah } from '@/lib/format'

export type OpenShift = {
  id: string
  openedAt: string
  openingCash: number
  cashSales: number
  trxCount: number
}

/**
 * Tutup shift.
 *
 * Kasir memasukkan jumlah uang fisik di laci, lalu sistem membandingkannya
 * dengan yang seharusnya. Selisihnya ditampilkan apa adanya — itu justru inti
 * gunanya, bukan sesuatu yang perlu disembunyikan.
 */
export function ShiftCard({ shift }: { shift: OpenShift }) {
  const [closing, setClosing] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ expected: number; actual: number; difference: number } | null>(
    null,
  )

  const expected = shift.openingCash + shift.cashSales

  async function submit() {
    const amount = Number(closing)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Masukkan jumlah uang tunai di laci.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await closeShift(shift.id, Math.round(amount), null)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    setResult({ expected: res.expected, actual: res.actual, difference: res.difference })
  }

  if (result) {
    const selisih = result.difference
    return (
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Shift Ditutup</div>
        <div className="kv">
          <span>Seharusnya</span>
          <span>{rupiah(result.expected)}</span>
        </div>
        <div className="kv">
          <span>Dihitung</span>
          <span>{rupiah(result.actual)}</span>
        </div>
        <div className="kv">
          <span>Selisih</span>
          <span style={{ color: selisih === 0 ? 'var(--color-success)' : 'var(--color-coral)' }}>
            {selisih === 0 ? 'Pas' : (selisih > 0 ? '+' : '') + rupiah(selisih)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        Shift Berjalan
        <span className="badge badge-active">Sejak {jam(shift.openedAt)}</span>
      </div>

      <div className="mini-stat-row" style={{ marginBottom: 16 }}>
        <div className="mini-stat">
          <b>{shift.trxCount}</b>
          <span>Transaksi</span>
        </div>
        <div className="mini-stat">
          <b>{rupiah(shift.cashSales)}</b>
          <span>Penjualan tunai</span>
        </div>
        <div className="mini-stat">
          <b>{rupiah(expected)}</b>
          <span>Kas seharusnya</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="closing">Uang tunai di laci</label>
        <NumberField
          id="closing"
          value={closing}
          onChange={setClosing}
          placeholder="Hitung fisik, lalu isi di sini"
        />
      </div>

      {error && (
        <div className="empty-note" style={{ marginBottom: 12 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-dark btn-block"
        disabled={busy || closing === ''}
        onClick={submit}
      >
        {busy ? 'Menutup…' : 'Akhiri Shift'}
      </button>
    </div>
  )
}
