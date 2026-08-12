'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  transferStock,
  type OutletResult,
} from '@/app/(toko)/pengaturan/outlet-actions'
import { SortTh, useTableSort } from '@/components/data/SortableTable'
import { Icon } from '@/components/ui/icons'
import { tanggal } from '@/lib/format'
import {
  TransferDrawer,
  type TransferOutlet,
  type TransferProduct,
} from './TransferDrawer'

export type TransferRow = {
  id: string
  code: string
  transferredOn: string
  note: string | null
  fromName: string
  toName: string
  totalQty: number
  items: { name: string; unit: string; quantity: number }[]
}

export function TransferManager({
  fromOutlet,
  outlets,
  products,
  transfers,
}: {
  fromOutlet: TransferOutlet | null
  outlets: TransferOutlet[]
  products: TransferProduct[]
  transfers: TransferRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const { sorted: urutTransfers, ...urut } = useTableSort(transfers, {
    key: 'transferredOn',
    dir: 'desc',
  })
  const [open, setOpen] = useState(false)

  const canTransfer = outlets.filter((o) => o.isActive).length > 1 && fromOutlet !== null

  function run(fn: () => Promise<OutletResult>, done?: () => void) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setNotice({ ok: false, text: res.error })
        return
      }
      setNotice(res.message ? { ok: true, text: res.message } : null)
      done?.()
      router.refresh()
    })
  }

  return (
    <>
      {notice && (
        <div
          className="empty-note"
          style={
            notice.ok
              ? {
                  marginBottom: 16,
                  background: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                }
              : { marginBottom: 16 }
          }
          role="alert"
        >
          <Icon name={notice.ok ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice.text}</div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {transfers.length} perpindahan tercatat
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canTransfer || pending}
            title={canTransfer ? undefined : 'Butuh minimal dua outlet aktif'}
            onClick={() => {
              setNotice(null)
              setOpen(true)
            }}
          >
            <Icon name="plus" size={15} /> Pindah Stok
          </button>
        </div>

        {transfers.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            {canTransfer
              ? 'Belum ada perpindahan barang antar cabang.'
              : 'Pindah stok butuh minimal dua outlet aktif. Tambah cabang dulu di Pengaturan → Outlet.'}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="buy-table">
              <thead>
                <tr>
                  <SortTh<TransferRow> label="Nota" sortKey="code" state={urut} />
                  <SortTh<TransferRow> label="Tanggal" sortKey="transferredOn" state={urut} />
                  <SortTh<TransferRow> label="Jumlah" sortKey="totalQty" state={urut} align="right" />
                </tr>
              </thead>
              <tbody>
                {urutTransfers.map((t) => (
                  <tr key={t.id}>
                    <td className="by-code">
                      <div className="cell-name mono">{t.code}</div>
                      <div className="cell-sub">
                        {t.fromName} → {t.toName}
                        {/* Isi notanya disebut apa adanya. Tanpa ini, "12 satuan"
                            tidak bisa dicocokkan dengan barang yang benar-benar
                            berpindah saat ada perselisihan. */}
                        {t.items.length > 0 && (
                          <>
                            {' · '}
                            {t.items
                              .map((i) => `${i.name} ${i.quantity} ${i.unit}`)
                              .join(', ')}
                          </>
                        )}
                        {t.note ? ` · ${t.note}` : ''}
                      </div>
                    </td>
                    <td className="by-date">{tanggal(t.transferredOn)}</td>
                    <td className="by-total" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {t.totalQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="field-hint" style={{ marginTop: 12 }}>
        Riwayat ini menampilkan <strong>seluruh perpindahan toko</strong>, bukan hanya cabang yang
        sedang dibuka. Sebuah transfer punya dua sisi dan keduanya sama-sama nyata. Barang yang
        dipindahkan selalu berasal dari cabang yang sedang dibuka; untuk memindahkan dari cabang
        lain, pindah dulu lewat pemilih di bar atas.
      </p>

      {open && fromOutlet && (
        <TransferDrawer
          fromOutlet={fromOutlet}
          outlets={outlets}
          products={products}
          pending={pending}
          onSubmit={(v, done) => run(() => transferStock(v), done)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
