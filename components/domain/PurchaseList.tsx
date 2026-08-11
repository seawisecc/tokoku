'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupplier, markPurchasePaid } from '@/app/(toko)/pembelian/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { PurchaseDrawer, type PickProduct, type PickSupplier } from './PurchaseDrawer'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah, tanggal } from '@/lib/format'

export type PurchaseRow = {
  id: string
  code: string
  invoiceNo: string | null
  purchasedAt: string
  total: number
  payment: string
  dueDate: string | null
  paidAt: string | null
  supplierName: string | null
  /** null kalau toko cuma punya satu outlet — tidak perlu disebut. */
  outletName: string | null
}

/**
 * Selisih HARI KALENDER, bukan selisih waktu.
 *
 * Memakai selisih jam lalu dibulatkan membuat nota yang jatuh tempo lusa
 * tertulis "3 hari lagi" — orang menghitung tanggal, bukan durasi.
 */
function daysLeft(due: string): number {
  const jatuh = new Date(due + 'T00:00:00').getTime()
  const kini = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  return Math.round((jatuh - kini) / 86_400_000)
}

export function PurchaseList({
  purchases,
  products,
  suppliers,
  canUseSupplier,
}: {
  purchases: PurchaseRow[]
  products: PickProduct[]
  suppliers: PickSupplier[]
  canUseSupplier: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [supplierForm, setSupplierForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const outstanding = purchases.filter((p) => p.payment === 'credit' && !p.paidAt)
  const owed = outstanding.reduce((n, p) => n + p.total, 0)

  return (
    <>
      {notice && (
        <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice}</div>
        </div>
      )}

      {canUseSupplier && outstanding.length > 0 && (
        <div
          className="empty-note"
          style={{
            marginBottom: 16,
            background: 'var(--color-amber-soft)',
            color: 'var(--color-amber-ink)',
          }}
          role="status"
        >
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong>
              {outstanding.length} nota belum lunas · {rupiah(owed)}
            </strong>{' '}
            Tandai lunas begitu dibayar supaya pengingatnya berhenti.
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {purchases.length} pembelian tercatat
          </div>
          {canUseSupplier && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setSupplierForm(true)}
            >
              <Icon name="plus" size={13} /> Pemasok
            </button>
          )}
          <button className="btn btn-primary" type="button" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Catat Pembelian
          </button>
        </div>

        {purchases.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada pembelian. Catat barang masuk supaya stok dan harga pokok ikut benar.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="buy-table">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Tanggal</th>
                  <th>Pembayaran</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const unpaid = p.payment === 'credit' && !p.paidAt
                  const left = unpaid && p.dueDate ? daysLeft(p.dueDate) : null
                  return (
                    <tr key={p.id}>
                      <td className="by-code">
                        <div className="cell-name mono">{p.code}</div>
                        <div className="cell-sub">
                          {p.supplierName ?? 'Tanpa pemasok'}
                          {p.invoiceNo ? ` · ${p.invoiceNo}` : ''}
                          {p.outletName ? ` · ${p.outletName}` : ''}
                        </div>
                      </td>
                      <td className="by-date">{tanggal(p.purchasedAt)}</td>
                      <td className="by-pay">
                        {p.payment === 'paid' || p.paidAt ? (
                          <span className="badge badge-ok">Lunas</span>
                        ) : (
                          <span
                            className={cn('badge', left !== null && left < 0 ? 'badge-low' : 'badge-trial')}
                          >
                            {left === null
                              ? 'Tempo'
                              : left < 0
                                ? `Telat ${Math.abs(left)} hari`
                                : left === 0
                                  ? 'Jatuh tempo hari ini'
                                  : `${left} hari lagi`}
                          </span>
                        )}
                        {unpaid && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 8 }}
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const res = await markPurchasePaid(p.id)
                                if (!res.ok) setNotice(res.error)
                                else router.refresh()
                              })
                            }
                          >
                            Tandai lunas
                          </button>
                        )}
                      </td>
                      <td className="by-total" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {rupiah(p.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Konsinyasi sengaja jadi tautan di sini, bukan menu sendiri: bottom nav
          ponsel sudah pas lima slot. Pola yang sama dengan /laporan/shift. */}
      {canUseSupplier && (
        <Link href="/pembelian/konsinyasi" className="link-card" style={{ marginTop: 14 }}>
          <Icon name="layers" size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cell-name">Konsinyasi</div>
            <div className="cell-sub">
              Barang titipan pemasok. Toko hanya berhutang atas yang terjual.
            </div>
          </div>
          <Icon name="chevronRight" size={14} />
        </Link>
      )}

      {!canUseSupplier && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          Paket ini mencatat barang masuk. Stok dan harga pokok tetap akurat. Pencatatan pemasok,
          tempo, dan hutang dagang tersedia mulai paket Growth.
        </p>
      )}

      {adding && (
        <PurchaseDrawer
          products={products}
          suppliers={suppliers}
          canUseSupplier={canUseSupplier}
          onClose={() => setAdding(false)}
        />
      )}

      {supplierForm && (
        <Drawer
          open
          title="Tambah Pemasok"
          onClose={() => setSupplierForm(false)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                type="button"
                onClick={() => setSupplierForm(false)}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await createSupplier(name, phone)
                    if (!res.ok) {
                      setNotice(res.error)
                      return
                    }
                    setName('')
                    setPhone('')
                    setSupplierForm(false)
                    router.refresh()
                  })
                }
              >
                {pending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="supName">Nama Pemasok</label>
            <input id="supName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="supPhone">Telepon</label>
            <input
              id="supPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opsional"
            />
          </div>
        </Drawer>
      )}
    </>
  )
}
