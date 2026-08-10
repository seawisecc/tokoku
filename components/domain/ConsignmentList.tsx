'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  endConsignment,
  recordIntake,
  recordReturn,
  settleSupplier,
  type ConsignResult,
} from '@/app/(toko)/pembelian/konsinyasi/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { rupiah, tanggal } from '@/lib/format'

export type ConsignRow = {
  id: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  sku: string
  unit: string
  sellPrice: number
  consignPrice: number
  qtyIn: number
  qtyReturned: number
  qtySold: number
  qtyLeft: number
  qtyUnsettled: number
  amountDue: number
  endedAt: string | null
  /** null kalau toko cuma punya satu outlet. */
  outletName: string | null
}

export type ConsignProduct = {
  id: string
  name: string
  sku: string
  unit: string
  sellPrice: number
  trackStock: boolean
  /** Stok yang sudah ada sebelum dititipkan — lihat peringatan di IntakeDrawer. */
  stock: number
}

export type ConsignSupplier = { id: string; name: string }

export type SettlementRow = {
  id: string
  code: string
  settledOn: string
  quantity: number
  total: number
  note: string | null
  supplierName: string
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })

const onlyDigits = (s: string) => s.replace(/[^\d]/g, '')

export function ConsignmentList({
  rows,
  products,
  suppliers,
  settlements,
}: {
  rows: ConsignRow[]
  products: ConsignProduct[]
  suppliers: ConsignSupplier[]
  settlements: SettlementRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const [intakeOpen, setIntakeOpen] = useState(false)
  const [returning, setReturning] = useState<ConsignRow | null>(null)
  const [settling, setSettling] = useState<{ id: string; name: string; due: number } | null>(null)

  const active = rows.filter((r) => !r.endedAt)
  const closed = rows.filter((r) => r.endedAt)

  /** Hutang bagi hasil dikelompokkan per pemasok — itu cara orang membayarnya. */
  const bySupplier = useMemo(() => {
    const map = new Map<string, { id: string; name: string; due: number; qty: number }>()
    for (const r of active) {
      if (r.qtyUnsettled <= 0) continue
      const cur = map.get(r.supplierId) ?? {
        id: r.supplierId,
        name: r.supplierName,
        due: 0,
        qty: 0,
      }
      cur.due += r.amountDue
      cur.qty += r.qtyUnsettled
      map.set(r.supplierId, cur)
    }
    return [...map.values()].sort((a, b) => b.due - a.due)
  }, [active])

  const totalDue = bySupplier.reduce((n, s) => n + s.due, 0)
  const totalLeft = active.reduce((n, r) => n + r.qtyLeft, 0)

  function run(fn: () => Promise<ConsignResult>, onDone?: () => void) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setNotice({ ok: false, text: res.error })
        return
      }
      setNotice({ ok: true, text: res.message })
      onDone?.()
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
                  marginBottom: 14,
                  background: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                }
              : { marginBottom: 14 }
          }
          role="alert"
        >
          <Icon name={notice.ok ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice.text}</div>
        </div>
      )}

      <div className="mini-stat-row" style={{ marginBottom: 18 }}>
        <div className="mini-stat">
          <b>{active.length}</b>
          <span>Titipan berjalan</span>
        </div>
        <div className="mini-stat">
          <b>{totalLeft}</b>
          <span>Satuan di rak</span>
        </div>
        <div className="mini-stat">
          <b style={{ color: totalDue > 0 ? 'var(--color-coral)' : undefined }}>
            {rupiah(totalDue)}
          </b>
          <span>Belum disetor</span>
        </div>
      </div>

      {bySupplier.length > 0 && (
        <div className="table-card" style={{ marginBottom: 18 }}>
          <div className="table-toolbar">
            <div style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>Bagi hasil belum disetor</div>
          </div>
          {bySupplier.map((s) => (
            <div className="consign-due" key={s.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cell-name">{s.name}</div>
                <div className="cell-sub">{s.qty} satuan terjual belum disetorkan</div>
              </div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {rupiah(s.due)}
              </div>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={pending}
                onClick={() => setSettling({ id: s.id, name: s.name, due: s.due })}
              >
                Setor
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {active.length} titipan berjalan
            {closed.length > 0 ? ` · ${closed.length} sudah ditutup` : ''}
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setNotice(null)
              setIntakeOpen(true)
            }}
          >
            <Icon name="plus" size={15} /> Terima Titipan
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada barang titipan. Catat titipan supaya yang terjual bisa dihitung bagi hasilnya
            dan sisanya bisa diretur.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="consign-table">
              <thead>
                <tr>
                  <th>Barang &amp; pemasok</th>
                  <th style={{ textAlign: 'right' }}>Sisa</th>
                  <th style={{ textAlign: 'right' }}>Terjual</th>
                  <th style={{ textAlign: 'right' }}>Belum disetor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={r.endedAt ? { opacity: 0.55 } : undefined}>
                    <td className="cn-what">
                      <div className="cell-name">
                        <Link href={`/produk/${r.productId}`} style={{ color: 'inherit' }}>
                          {r.productName}
                        </Link>
                        {r.endedAt && (
                          <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                            Ditutup
                          </span>
                        )}
                      </div>
                      <div className="cell-sub">
                        {r.supplierName} · titip {rupiah(r.consignPrice)} · jual{' '}
                        {rupiah(r.sellPrice)}
                        {r.outletName ? ` · ${r.outletName}` : ''}
                      </div>
                    </td>
                    <td className="cn-left" style={{ textAlign: 'right' }}>
                      {r.qtyLeft} {r.unit}
                    </td>
                    <td className="cn-sold" style={{ textAlign: 'right' }}>
                      {r.qtySold} {r.unit}
                    </td>
                    <td className="cn-due" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {r.qtyUnsettled > 0 ? rupiah(r.amountDue) : '—'}
                    </td>
                    <td className="cn-act">
                      {!r.endedAt && (
                        <div className="row-flex" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            disabled={pending || r.qtyLeft <= 0}
                            title={r.qtyLeft <= 0 ? 'Tidak ada sisa yang bisa diretur' : undefined}
                            onClick={() => {
                              setNotice(null)
                              setReturning(r)
                            }}
                          >
                            Retur
                          </button>
                          {r.qtyLeft === 0 && r.qtyUnsettled === 0 && r.qtyIn > 0 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => endConsignment(r.id))}
                            >
                              Tutup
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="field-hint" style={{ marginTop: 12 }}>
        Bagi hasil dihitung <strong>kumulatif</strong>: seluruh yang terjual sampai detik ini
        dikurangi yang sudah pernah disetorkan. Penjualan dari kasir yang sedang offline dan baru
        masuk belakangan ikut terhitung sendiri di setoran berikutnya.
      </p>

      {settlements.length > 0 && (
        <>
          <div className="section-title">Riwayat Setoran</div>
          <div className="table-card">
            <div className="table-scroll">
              <table className="buy-table">
                <thead>
                  <tr>
                    <th>Setoran</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'right' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td className="by-code">
                        <div className="cell-name mono">{s.code}</div>
                        <div className="cell-sub">
                          {s.supplierName} · {s.quantity} satuan
                          {s.note ? ` · ${s.note}` : ''}
                        </div>
                      </td>
                      <td className="by-date">{tanggal(s.settledOn)}</td>
                      <td className="by-total" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {rupiah(s.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {intakeOpen && (
        <IntakeDrawer
          products={products}
          suppliers={suppliers}
          active={active}
          pending={pending}
          onSubmit={(input, done) => run(() => recordIntake(input), done)}
          onClose={() => setIntakeOpen(false)}
        />
      )}

      {returning && (
        <ReturnDrawer
          key={returning.id}
          row={returning}
          pending={pending}
          onSubmit={(input, done) => run(() => recordReturn(input), done)}
          onClose={() => setReturning(null)}
        />
      )}

      {settling && (
        <SettleDrawer
          key={settling.id}
          supplier={settling}
          pending={pending}
          onSubmit={(input, done) => run(() => settleSupplier(input), done)}
          onClose={() => setSettling(null)}
        />
      )}
    </>
  )
}

/* ---------------- Terima titipan ---------------- */

function IntakeDrawer({
  products,
  suppliers,
  active,
  pending,
  onSubmit,
  onClose,
}: {
  products: ConsignProduct[]
  suppliers: ConsignSupplier[]
  active: ConsignRow[]
  pending: boolean
  onSubmit: (
    input: {
      supplierId: string
      productId: string
      quantity: number
      consignPrice: number
      occurredOn: string
      note: string
    },
    done: () => void,
  ) => void
  onClose: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [note, setNote] = useState('')

  const product = products.find((p) => p.id === productId)
  const existing = active.find((r) => r.productId === productId)

  /**
   * Titipan yang sedang berjalan menentukan harga titipnya, jadi harga diisikan
   * dan tidak boleh berbeda — database menolak perubahan harga selagi masih ada
   * yang belum disetorkan, dan menolaknya SETELAH borang diisi penuh adalah cara
   * paling menjengkelkan menyampaikan aturan itu.
   */
  function pickProduct(id: string) {
    setProductId(id)
    const found = active.find((r) => r.productId === id)
    if (found) {
      setPrice(String(found.consignPrice))
      setSupplierId(found.supplierId)
    }
  }

  const margin =
    product && Number(price) > 0 ? product.sellPrice - Number(price) : null

  return (
    <Drawer
      open
      title="Terima Barang Titipan"
      subtitle="Stok langsung bertambah. Hutang ke pemasok baru muncul saat barangnya terjual."
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
            onClick={() =>
              onSubmit(
                {
                  supplierId,
                  productId,
                  quantity: Number(quantity) || 0,
                  consignPrice: Number(price) || 0,
                  occurredOn,
                  note,
                },
                onClose,
              )
            }
          >
            {pending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="cnProduct">Produk yang dititipkan</label>
        <select id="cnProduct" value={productId} onChange={(e) => pickProduct(e.target.value)}>
          <option value="">— Pilih produk</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        {product && !product.trackStock && (
          <div className="field-hint" style={{ color: 'var(--color-coral)' }}>
            Produk ini disetel tanpa pelacakan stok, jadi jumlah terjualnya tidak tercatat dan bagi
            hasilnya tidak bisa dihitung. Nyalakan dulu pelacakan stok di halaman Produk.
          </div>
        )}
        {/* Penjualan di kasir hanya tahu PRODUK, bukan siapa pemilik tiap
            satuannya. Kalau toko masih punya stok sendiri atas produk yang sama,
            setiap penjualan tetap dihitung sebagai hak pemasok — dan pemilik
            toko baru menyadarinya saat menyetor uang atas barangnya sendiri.
            Tidak dilarang: kadang memang stok lama yang tinggal sedikit. Tapi
            harus diucapkan sebelum disimpan, bukan setelahnya. */}
        {product && product.trackStock && !existing && product.stock > 0 && (
          <div className="field-hint" style={{ color: 'var(--color-amber-ink)' }}>
            Toko masih punya {product.stock} {product.unit} produk ini sebelum titipan masuk.
            Penjualannya nanti terhitung sebagai hak pemasok semua, karena kasir hanya mencatat
            produknya — bukan milik siapa tiap satuannya. Kalau stok lama itu milik toko sendiri,
            lebih aman membuat produk terpisah untuk barang titipan.
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="cnSupplier">Pemasok</label>
        <select
          id="cnSupplier"
          value={supplierId}
          disabled={!!existing}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">— Pilih pemasok</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {existing ? (
          <div className="field-hint">
            Produk ini sudah dititipkan {existing.supplierName}. Tambahan barangnya masuk ke titipan
            yang sedang berjalan.
          </div>
        ) : (
          <div className="field-hint">Tambah pemasok baru lewat halaman Pembelian.</div>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="cnQty">Jumlah {product ? `(${product.unit})` : ''}</label>
          <input
            id="cnQty"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(onlyDigits(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="cnPrice">Harga titip / satuan</label>
          <input
            id="cnPrice"
            inputMode="numeric"
            value={price}
            readOnly={!!existing}
            onChange={(e) => setPrice(onlyDigits(e.target.value))}
          />
        </div>
      </div>

      <div className="field-hint" style={{ marginTop: -6 }}>
        {existing
          ? 'Harga titip mengikuti kesepakatan yang sedang berjalan. Untuk mengubahnya, setorkan dulu bagi hasil yang belum dibayar.'
          : 'Bagian pemasok untuk setiap satuan yang terjual. Selisihnya dengan harga jual adalah bagian toko.'}
      </div>

      {margin !== null && product && (
        // `.empty-note` bawaannya berwarna coral — itu warna peringatan. Pembagian
        // hasil yang wajar bukan peringatan, jadi warnanya dinetralkan; hanya
        // margin negatif yang boleh tampil merah.
        <div
          className="empty-note"
          style={
            margin < 0
              ? { marginBottom: 14 }
              : {
                  marginBottom: 14,
                  background: 'var(--color-paper)',
                  color: 'var(--color-ink-soft)',
                }
          }
          role="status"
        >
          <div style={{ flex: 1 }}>
            Terjual {rupiah(product.sellPrice)} · pemasok {rupiah(Number(price))} ·{' '}
            <strong style={{ color: margin < 0 ? undefined : 'var(--color-ink)' }}>
              toko {rupiah(margin)}
            </strong>{' '}
            per {product.unit}
            {margin < 0 && ' — harga titip lebih tinggi dari harga jual, toko rugi tiap penjualan.'}
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="cnDate">Tanggal terima</label>
          <input
            id="cnDate"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cnNote">Catatan</label>
          <input
            id="cnNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opsional"
          />
        </div>
      </div>
    </Drawer>
  )
}

/* ---------------- Retur ---------------- */

function ReturnDrawer({
  row,
  pending,
  onSubmit,
  onClose,
}: {
  row: ConsignRow
  pending: boolean
  onSubmit: (
    input: { consignmentId: string; quantity: number; occurredOn: string; note: string },
    done: () => void,
  ) => void
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState(String(row.qtyLeft))
  const [occurredOn, setOccurredOn] = useState(today())
  const [note, setNote] = useState('')

  const qty = Number(quantity) || 0
  const tooMany = qty > row.qtyLeft

  return (
    <Drawer
      open
      title="Retur ke Pemasok"
      subtitle={`${row.productName} · ${row.supplierName}`}
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
            disabled={pending || tooMany || qty <= 0}
            onClick={() =>
              onSubmit({ consignmentId: row.id, quantity: qty, occurredOn, note }, onClose)
            }
          >
            {pending ? 'Menyimpan…' : 'Simpan retur'}
          </button>
        </>
      }
    >
      <div className="mini-stat-row" style={{ marginBottom: 16 }}>
        <div className="mini-stat">
          <b>
            {row.qtyLeft} {row.unit}
          </b>
          <span>Sisa di rak</span>
        </div>
        <div className="mini-stat">
          <b>
            {row.qtySold} {row.unit}
          </b>
          <span>Sudah terjual</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="rtQty">Jumlah diretur ({row.unit})</label>
        <input
          id="rtQty"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(onlyDigits(e.target.value))}
        />
        {tooMany && (
          <div className="field-hint" style={{ color: 'var(--color-coral)' }}>
            Sisa titipan tinggal {row.qtyLeft} {row.unit}.
          </div>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="rtDate">Tanggal retur</label>
          <input
            id="rtDate"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rtNote">Catatan</label>
          <input
            id="rtNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opsional"
          />
        </div>
      </div>

      <p className="field-hint">
        Retur mengurangi stok toko dan tidak melibatkan uang — barang yang belum laku kembali ke
        pemasok. Yang sudah terjual tetap jadi hutang dan disetorkan terpisah.
      </p>
    </Drawer>
  )
}

/* ---------------- Setor bagi hasil ---------------- */

function SettleDrawer({
  supplier,
  pending,
  onSubmit,
  onClose,
}: {
  supplier: { id: string; name: string; due: number }
  pending: boolean
  onSubmit: (
    input: { supplierId: string; settledOn: string; note: string },
    done: () => void,
  ) => void
  onClose: () => void
}) {
  const [settledOn, setSettledOn] = useState(today())
  const [note, setNote] = useState('')

  return (
    <Drawer
      open
      title="Setor Bagi Hasil"
      subtitle={supplier.name}
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
            onClick={() => onSubmit({ supplierId: supplier.id, settledOn, note }, onClose)}
          >
            {pending ? 'Menyimpan…' : `Setor · ${rupiah(supplier.due)}`}
          </button>
        </>
      }
    >
      {/* Warna netral: ini keterangan, bukan peringatan. `.empty-note` bawaannya
          coral, dan memakainya di sini membuat setoran yang wajar terbaca
          seperti ada yang salah. */}
      <div
        className="empty-note"
        style={{
          marginBottom: 16,
          background: 'var(--color-paper)',
          color: 'var(--color-ink-soft)',
        }}
        role="status"
      >
        <div style={{ flex: 1 }}>
          Seluruh titipan {supplier.name} yang sudah terjual dan belum disetorkan dihitung sekaligus
          — total <strong style={{ color: 'var(--color-ink)' }}>{rupiah(supplier.due)}</strong>.
        </div>
      </div>

      <div className="field">
        <label htmlFor="stDate">Tanggal setor</label>
        <input
          id="stDate"
          type="date"
          value={settledOn}
          onChange={(e) => setSettledOn(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="stNote">Catatan</label>
        <input
          id="stNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opsional — mis. cara bayarnya"
        />
      </div>

      <p className="field-hint">
        Angkanya diambil ulang dari database saat disimpan, jadi penjualan yang masuk beberapa detik
        terakhir tetap ikut terhitung.
      </p>
    </Drawer>
  )
}
