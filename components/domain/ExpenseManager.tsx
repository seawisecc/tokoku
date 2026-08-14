'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  saveExpense,
} from '@/app/(toko)/laporan/pengeluaran/actions'
import { Drawer } from '@/components/overlay/Drawer'
import { IconAction } from '@/components/data/IconAction'
import { Icon } from '@/components/ui/icons'
import { rupiah, tanggal } from '@/lib/format'

export type ExpenseRow = {
  id: string
  expenseDate: string
  amount: number
  paymentMethod: string
  payee: string | null
  note: string | null
  categoryId: string
  categoryName: string
  outletId: string | null
  /** null kalau toko cuma punya satu outlet, atau kalau ini pengeluaran seluruh toko. */
  outletName: string | null
}

export type ExpenseCategory = { id: string; name: string }
export type ExpenseOutlet = { id: string; name: string }

const METODE: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  other: 'Lainnya',
}

/** Isian kosong untuk pengeluaran baru. Hari ini menurut jam Indonesia Tengah. */
const kosong = (): ExpenseRow => ({
  id: '',
  expenseDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }),
  amount: 0,
  paymentMethod: 'cash',
  payee: null,
  note: null,
  categoryId: '',
  categoryName: '',
  outletId: null,
  outletName: null,
})

export function ExpenseManager({
  expenses,
  categories,
  outlets,
  periodLabel,
}: {
  expenses: ExpenseRow[]
  categories: ExpenseCategory[]
  /** Kosong kalau tokonya cuma punya satu outlet: tidak ada yang perlu dipilih. */
  outlets: ExpenseOutlet[]
  periodLabel: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [kelolaKategori, setKelolaKategori] = useState(false)

  const total = expenses.reduce((n, e) => n + e.amount, 0)

  // Per kategori, terbesar dulu. Yang dicari pemilik toko saat membuka halaman
  // ini bukan daftar barisnya, melainkan "uangnya habis ke mana".
  const perKategori = [...expenses
    .reduce((map, e) => {
      map.set(e.categoryName, (map.get(e.categoryName) ?? 0) + e.amount)
      return map
    }, new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="hero">
        <div className="hero-label">Pengeluaran {periodLabel}</div>
        <div className="hero-num">{rupiah(total)}</div>
        <div className="hero-meta">
          <div>
            <b>{expenses.length}</b>
            <span>Catatan</span>
          </div>
          {perKategori.length > 0 && (
            <div>
              <b>{rupiah(perKategori[0][1])}</b>
              <span>Terbesar: {perKategori[0][0]}</span>
            </div>
          )}
        </div>
      </div>

      {perKategori.length > 1 && (
        <>
          <h2 className="section-title">Per Kategori</h2>
          <div className="table-card" style={{ marginBottom: 4 }}>
            {perKategori.map(([nama, jumlah]) => (
              <div className="consign-due" key={nama}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-name">{nama}</div>
                  <div className="cell-sub">{Math.round((jumlah / total) * 100)}% dari total</div>
                </div>
                <strong>{rupiah(jumlah)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Rincian</h2>
      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {expenses.length} pengeluaran
          </div>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setKelolaKategori(true)}
          >
            <Icon name="sliders" size={13} /> Kategori
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setEditing(kosong())}
            disabled={categories.length === 0}
          >
            <Icon name="plus" size={15} /> Catat Pengeluaran
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada pengeluaran di periode ini. Catat sewa, listrik, gaji, dan biaya lain supaya
            laporan keuangannya menunjukkan untung yang sebenarnya, bukan cuma laba kotor.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="buy-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Tanggal</th>
                  <th>Pembayaran</th>
                  <th style={{ textAlign: 'right' }}>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="by-code">
                      <div className="cell-name">{e.categoryName}</div>
                      <div className="cell-sub">
                        {[e.payee, e.note, e.outletName ?? (outlets.length > 1 ? 'Seluruh toko' : null)]
                          .filter(Boolean)
                          .join(' · ') || 'Tanpa keterangan'}
                      </div>
                    </td>
                    <td className="by-date">{tanggal(e.expenseDate)}</td>
                    <td className="by-pay">
                      <span className="badge">{METODE[e.paymentMethod] ?? e.paymentMethod}</span>
                      <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }}>
                        <IconAction icon="edit" label="Ubah" onClick={() => setEditing(e)} />
                        <IconAction
                          icon="trash"
                          label="Hapus"
                          danger
                          onClick={() => setEditing({ ...e, id: `hapus:${e.id}` })}
                        />
                      </span>
                    </td>
                    <td className="by-total" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {rupiah(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer dirender kondisional dengan `key`: `useState` cuma menjalankan
          initializer sekali, jadi drawer yang di-mount saat masih tertutup akan
          selamanya menampilkan isian kosong. */}
      {editing && !editing.id.startsWith('hapus:') && (
        <ExpenseDrawer
          key={editing.id || 'baru'}
          value={editing}
          categories={categories}
          outlets={outlets}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {editing && editing.id.startsWith('hapus:') && (
        <DeleteExpenseDrawer
          key={editing.id}
          value={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {kelolaKategori && (
        <CategoryDrawer
          categories={categories}
          onClose={() => setKelolaKategori(false)}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  )
}

/* ---------------------------------------------------------------- drawer isi */

function ExpenseDrawer({
  value,
  categories,
  outlets,
  onClose,
  onSaved,
}: {
  value: ExpenseRow
  categories: ExpenseCategory[]
  outlets: ExpenseOutlet[]
  onClose: () => void
  onSaved: () => void
}) {
  // Semua isian terkendali state: React 19 me-reset <form> setelah action
  // selesai, jadi defaultValue hilang tiap kali validasi gagal.
  const [categoryId, setCategoryId] = useState(value.categoryId || categories[0]?.id || '')
  const [expenseDate, setExpenseDate] = useState(value.expenseDate)
  const [amount, setAmount] = useState(value.amount ? String(value.amount) : '')
  const [paymentMethod, setPaymentMethod] = useState(value.paymentMethod)
  const [outletId, setOutletId] = useState(value.outletId ?? '')
  const [payee, setPayee] = useState(value.payee ?? '')
  const [note, setNote] = useState(value.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const simpan = () => {
    setError(null)
    const fd = new FormData()
    if (value.id) fd.set('id', value.id)
    fd.set('categoryId', categoryId)
    fd.set('expenseDate', expenseDate)
    fd.set('amount', amount)
    fd.set('paymentMethod', paymentMethod)
    fd.set('outletId', outletId)
    fd.set('payee', payee)
    fd.set('note', note)

    startTransition(async () => {
      const res = await saveExpense(fd)
      if (res.ok) onSaved()
      else setError(res.error)
    })
  }

  return (
    <Drawer
      open
      title={value.id ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" type="button" disabled={pending} onClick={simpan}>
            {pending ? 'Menyimpan…' : 'Simpan'}
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

      <div className="field">
        <label htmlFor="expKategori">Kategori</label>
        <select
          id="expKategori"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          autoFocus
        >
          {categories.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="expTanggal">Tanggal</label>
        <input
          id="expTanggal"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />
        <div className="field-hint">
          Tanggal uangnya keluar. Nota bulan lalu yang baru sempat dicatat tetap diisi tanggal
          aslinya supaya laporannya tidak bergeser bulan.
        </div>
      </div>

      <div className="field">
        <label htmlFor="expJumlah">Jumlah</label>
        <input
          id="expJumlah"
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="field">
        <label htmlFor="expMetode">Dibayar Pakai</label>
        <select
          id="expMetode"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          {Object.entries(METODE).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <div className="field-hint">
          Ini yang membedakan uang keluar dari laci dengan yang keluar dari rekening.
        </div>
      </div>

      {outlets.length > 1 && (
        <div className="field">
          <label htmlFor="expOutlet">Cabang</label>
          <select id="expOutlet" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">Seluruh toko</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <div className="field-hint">
            Pilih &quot;Seluruh toko&quot; untuk biaya yang tidak bisa dibebankan ke satu cabang,
            misalnya gaji admin atau langganan internet. Biaya itu ikut terhitung di laporan cabang
            mana pun.
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="expPenerima">Dibayar Ke</label>
        <input
          id="expPenerima"
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="Opsional, misalnya PLN atau nama pemilik kontrakan"
        />
      </div>

      <div className="field">
        <label htmlFor="expCatatan">Catatan</label>
        <input
          id="expCatatan"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opsional, misalnya periode tagihannya"
        />
      </div>
    </Drawer>
  )
}

/* -------------------------------------------------------------- drawer hapus */

function DeleteExpenseDrawer({
  value,
  onClose,
  onDone,
}: {
  value: ExpenseRow
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const id = value.id.replace('hapus:', '')

  return (
    <Drawer
      open
      title="Hapus Pengeluaran"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteExpense(id, reason)
                if (res.ok) onDone()
                else setError(res.error)
              })
            }
          >
            {pending ? 'Menghapus…' : 'Hapus'}
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

      <p className="auth-sub" style={{ marginBottom: 14 }}>
        {value.categoryName} · {rupiah(value.amount)} · {tanggal(value.expenseDate)}
      </p>

      <div className="field">
        <label htmlFor="expAlasan">Alasan Menghapus</label>
        <input
          id="expAlasan"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Misalnya: salah ketik, dicatat dua kali"
          autoFocus
        />
        <div className="field-hint">
          Barisnya tidak benar-benar dibuang, hanya ditandai terhapus dan tidak lagi dihitung.
          Alasannya ikut tersimpan supaya angka laporan yang berubah selalu ada penjelasannya.
        </div>
      </div>
    </Drawer>
  )
}

/* ----------------------------------------------------------- drawer kategori */

function CategoryDrawer({
  categories,
  onClose,
  onChanged,
}: {
  categories: ExpenseCategory[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Drawer
      open
      title="Kategori Pengeluaran"
      onClose={onClose}
      footer={
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Tutup
        </button>
      }
    >
      {error && (
        <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      <div className="field">
        <label htmlFor="katNama">Kategori Baru</label>
        <div className="btn-pair">
          <input
            id="katNama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Misalnya: Iuran keamanan"
          />
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending || name.trim().length < 2}
            onClick={() =>
              startTransition(async () => {
                const res = await createExpenseCategory(name)
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                setName('')
                setError(null)
                onChanged()
              })
            }
          >
            Tambah
          </button>
        </div>
      </div>

      {categories.map((k) => (
        <div className="consign-due" key={k.id}>
          <div style={{ flex: 1, minWidth: 0 }} className="cell-name">
            {k.name}
          </div>
          <IconAction
            icon="trash"
            label="Hapus"
            danger
            confirm
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteExpenseCategory(k.id)
                if (!res.ok) setError(res.error)
                else {
                  setError(null)
                  onChanged()
                }
              })
            }
          />
        </div>
      ))}
    </Drawer>
  )
}
