'use client'

import { useMemo, useState } from 'react'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'

export type TransferOutlet = { id: string; name: string; isActive: boolean }
export type TransferProduct = { id: string; name: string; sku: string; unit: string; stock: number }

type Line = { productId: string; quantity: string }

const onlyDigits = (s: string) => s.replace(/[^\d]/g, '')
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })

/**
 * Form pindah stok antar outlet.
 *
 * Stok yang ditampilkan adalah stok di OUTLET ASAL, dan itu selalu outlet yang
 * sedang dibuka — daftar produk beserta sisanya sudah dirender server untuk
 * outlet aktif, dan mengambil ulang stok cabang lain saat asalnya diganti
 * berarti satu putaran jaringan lagi di tengah pengisian borang.
 *
 * Konsekuensinya asal dikunci ke outlet aktif dan disebut apa adanya. Untuk
 * memindahkan dari cabang lain, pemilik berpindah dulu lewat pemilih di topbar —
 * satu langkah, dan angkanya dijamin angka yang benar-benar ia lihat.
 */
export function TransferDrawer({
  fromOutlet,
  outlets,
  products,
  pending,
  onSubmit,
  onClose,
}: {
  fromOutlet: TransferOutlet
  outlets: TransferOutlet[]
  products: TransferProduct[]
  pending: boolean
  onSubmit: (
    v: {
      fromOutletId: string
      toOutletId: string
      transferredOn: string
      note: string
      items: { productId: string; quantity: number }[]
    },
    done: () => void,
  ) => void
  onClose: () => void
}) {
  const targets = outlets.filter((o) => o.id !== fromOutlet.id && o.isActive)

  const [toOutletId, setToOutletId] = useState(targets[0]?.id ?? '')
  const [transferredOn, setTransferredOn] = useState(today())
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '1' }])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  function setLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const totalQty = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0)
  // Kelebihan ditandai SEBELUM disimpan. Database juga menolaknya, tapi
  // penolakan yang datang setelah lima baris diisi jauh lebih menjengkelkan
  // daripada angka merah yang muncul saat itu juga.
  const over = lines.some((l) => {
    const p = byId.get(l.productId)
    return p ? (Number(l.quantity) || 0) > p.stock : false
  })

  return (
    <Drawer
      open
      title="Pindah Stok"
      subtitle={`Dari ${fromOutlet.name}`}
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
            disabled={pending || over || totalQty === 0 || !toOutletId}
            onClick={() =>
              onSubmit(
                {
                  fromOutletId: fromOutlet.id,
                  toOutletId,
                  transferredOn,
                  note,
                  items: lines
                    .filter((l) => l.productId && Number(l.quantity) > 0)
                    .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
                },
                onClose,
              )
            }
          >
            {pending ? 'Memindahkan…' : `Pindahkan ${totalQty} satuan`}
          </button>
        </>
      }
    >
      {targets.length === 0 ? (
        <div className="empty-note" role="status">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            Belum ada outlet lain yang aktif sebagai tujuan. Tambah outlet dulu di halaman ini.
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="tfTo">Pindahkan ke</label>
            <select id="tfTo" value={toOutletId} onChange={(e) => setToOutletId(e.target.value)}>
              {targets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="field-hint">
              Asalnya <strong>{fromOutlet.name}</strong> — outlet yang sedang dibuka. Untuk
              memindahkan dari cabang lain, pindah dulu lewat pemilih di bar atas.
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 6 }}>
            Barang
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setLines((c) => [...c, { productId: '', quantity: '1' }])}
            >
              <Icon name="plus" size={13} /> Baris
            </button>
          </div>

          {lines.map((l, i) => {
            const p = byId.get(l.productId)
            const qty = Number(l.quantity) || 0
            const tooMany = p ? qty > p.stock : false
            return (
              <div className="buy-line" key={i}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <select
                    value={l.productId}
                    onChange={(e) => setLine(i, { productId: e.target.value })}
                  >
                    <option value="">— Pilih produk</option>
                    {products.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.stock} {op.unit})
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
                      onChange={(e) => setLine(i, { quantity: onlyDigits(e.target.value) })}
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
                {p && (
                  <div
                    className="field-hint"
                    style={tooMany ? { color: 'var(--color-coral)' } : undefined}
                  >
                    {tooMany
                      ? `Stok di ${fromOutlet.name} tinggal ${p.stock} ${p.unit}.`
                      : `Sisa di ${fromOutlet.name} setelah dipindah: ${p.stock - qty} ${p.unit}.`}
                  </div>
                )}
              </div>
            )
          })}

          <div className="field-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="tfDate">Tanggal</label>
              <input
                id="tfDate"
                type="date"
                value={transferredOn}
                onChange={(e) => setTransferredOn(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tfNote">Catatan</label>
              <input
                id="tfNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>

          <p className="field-hint">
            Stok langsung berpindah — tidak ada status &ldquo;dalam perjalanan&rdquo;. Kedua sisinya
            tercatat di kartu stok masing-masing produk dan menunjuk nota yang sama.
          </p>
        </>
      )}
    </Drawer>
  )
}
