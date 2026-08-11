'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createOutlet,
  deactivateOutlet,
  reactivateOutlet,
  setPrimaryOutlet,
  switchOutlet,
  transferStock,
  updateOutlet,
  type OutletResult,
} from '@/app/(toko)/pengaturan/outlet-actions'
import { IconAction } from '@/components/data/IconAction'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { TransferDrawer, type TransferProduct } from './TransferDrawer'

export type OutletRow = {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  isPrimary: boolean
  isActive: boolean
}

export type OutletQuota = { used: number; limit: number | null }

export function OutletManager({
  outlets,
  activeOutletId,
  quota,
  products,
}: {
  outlets: OutletRow[]
  activeOutletId: string | null
  quota: OutletQuota
  /** Stok di outlet AKTIF — dipakai form pindah stok. */
  products: TransferProduct[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OutletRow | null>(null)
  const [transferring, setTransferring] = useState(false)

  const full = quota.limit !== null && quota.used >= quota.limit
  const active = outlets.find((o) => o.id === activeOutletId) ?? null

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

      <div className="section-title" style={{ marginTop: 0 }}>
        <span>
          Outlet{' '}
          <span style={{ fontWeight: 500, color: 'var(--color-ink-faint)', fontSize: 12.5 }}>
            {quota.used}
            {quota.limit !== null ? ` / ${quota.limit}` : ''}
          </span>
        </span>
        {/* Tombolnya dimatikan saat kuota penuh, bukan disembunyikan: pemilik toko
            harus tahu bahwa menambah cabang itu MUNGKIN, dan yang menghalangi
            adalah paketnya. Disembunyikan, ia mengira aplikasinya memang tidak
            bisa. */}
        <span className="row-flex" style={{ gap: 6 }}>
          {/* Muncul hanya kalau ada cabang lain yang bisa jadi tujuan. */}
          {outlets.filter((o) => o.isActive).length > 1 && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={pending}
              onClick={() => {
                setNotice(null)
                setTransferring(true)
              }}
            >
              Pindah Stok
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={full || pending}
            title={full ? 'Kuota outlet paket ini sudah penuh' : undefined}
            onClick={() => {
              setNotice(null)
              setAdding(true)
            }}
          >
            <Icon name="plus" size={14} /> Tambah Outlet
          </button>
        </span>
      </div>

      {full && (
        <p className="field-hint" style={{ margin: '-6px 0 14px' }}>
          Kuota outlet paket ini sudah terpakai semua ({quota.used}/{quota.limit}). Naikkan paket
          untuk membuka cabang berikutnya. Outlet yang dinonaktifkan tetap memakai jatahnya karena
          riwayat penjualannya masih tersimpan.
        </p>
      )}

      <div className="card" style={{ padding: '4px 16px' }}>
        {outlets.map((o) => (
          <div className="team-row" key={o.id}>
            <div className="team-avatar">
              <Icon name="store" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cell-name">
                {o.name}
                {o.isPrimary && (
                  <span className="badge badge-growth" style={{ marginLeft: 8 }}>
                    Utama
                  </span>
                )}
                {o.id === activeOutletId && (
                  <span className="badge badge-trial" style={{ marginLeft: 6 }}>
                    Sedang dibuka
                  </span>
                )}
                {!o.isActive && (
                  <span className="badge badge-ok" style={{ marginLeft: 6 }}>
                    Nonaktif
                  </span>
                )}
              </div>
              <div className="cell-sub">
                {o.code}
                {o.address ? ` · ${o.address}` : ''}
                {o.phone ? ` · ${o.phone}` : ''}
              </div>
            </div>

            <div className="row-flex" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {o.isActive && o.id !== activeOutletId && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => switchOutlet(o.id))}
                >
                  Buka
                </button>
              )}
              {o.isActive && !o.isPrimary && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPrimaryOutlet(o.id))}
                >
                  Jadikan utama
                </button>
              )}
              {!o.isActive && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => reactivateOutlet(o.id))}
                >
                  Aktifkan
                </button>
              )}
              <button
                className="icon-action"
                type="button"
                aria-label={`Ubah ${o.name}`}
                disabled={pending}
                onClick={() => {
                  setNotice(null)
                  setEditing(o)
                }}
              >
                <Icon name="edit" size={14} />
              </button>
              {o.isActive && !o.isPrimary && (
                <IconAction
                  icon="x"
                  label="Nonaktifkan"
                  danger
                  confirm
                  disabled={pending}
                  onClick={() => run(() => deactivateOutlet(o.id))}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="field-hint" style={{ marginTop: 12 }}>
        Outlet menentukan <strong>stok, kasir, dan laporan</strong> yang sedang Anda lihat. Pindah
        outlet lewat pemilih di bar atas. Outlet yang dinonaktifkan tidak dihapus. Transaksi,
        kartu stok, dan shift lamanya tetap bisa dibuka.
      </p>

      {adding && (
        <OutletDrawer
          key="baru"
          pending={pending}
          onSubmit={(v, done) => run(() => createOutlet(v), done)}
          onClose={() => setAdding(false)}
        />
      )}

      {transferring && active && (
        <TransferDrawer
          fromOutlet={{ id: active.id, name: active.name, isActive: active.isActive }}
          outlets={outlets.map((o) => ({ id: o.id, name: o.name, isActive: o.isActive }))}
          products={products}
          pending={pending}
          onSubmit={(v, done) => run(() => transferStock(v), done)}
          onClose={() => setTransferring(false)}
        />
      )}

      {editing && (
        <OutletDrawer
          key={editing.id}
          value={editing}
          pending={pending}
          onSubmit={(v, done) =>
            run(
              () => updateOutlet(editing.id, { name: v.name, address: v.address, phone: v.phone }),
              done,
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

/**
 * Form outlet.
 *
 * Dirender kondisional dengan `key` oleh pemanggilnya — `useState` hanya
 * menjalankan initializer sekali, jadi drawer yang di-mount saat masih tertutup
 * akan selamanya menampilkan isi outlet pertama yang pernah dibuka.
 */
function OutletDrawer({
  value,
  pending,
  onSubmit,
  onClose,
}: {
  value?: OutletRow
  pending: boolean
  onSubmit: (
    v: { name: string; code: string; address: string; phone: string },
    done: () => void,
  ) => void
  onClose: () => void
}) {
  const [name, setName] = useState(value?.name ?? '')
  const [code, setCode] = useState(value?.code ?? '')
  const [address, setAddress] = useState(value?.address ?? '')
  const [phone, setPhone] = useState(value?.phone ?? '')

  return (
    <Drawer
      open
      title={value ? 'Ubah Outlet' : 'Tambah Outlet'}
      subtitle={value ? value.code : 'Cabang baru dengan stok dan kasirnya sendiri.'}
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
            onClick={() => onSubmit({ name, code, address, phone }, onClose)}
          >
            {pending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="outName">Nama Outlet</label>
        <input
          id="outName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Cabang Renon"
        />
      </div>

      {/* Kode tidak bisa diubah setelah dibuat: ia ikut terbaca di laporan dan
          kartu stok, dan kode yang berpindah arti membuat riwayat lama tidak
          bisa dipercaya. */}
      {!value && (
        <div className="field">
          <label htmlFor="outCode">Kode</label>
          <input
            id="outCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kosongkan untuk dibuatkan otomatis"
          />
          <div className="field-hint">Muncul di laporan dan kartu stok. Tidak bisa diubah nanti.</div>
        </div>
      )}

      <div className="field">
        <label htmlFor="outAddress">Alamat</label>
        <input
          id="outAddress"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Opsional"
        />
      </div>
      <div className="field">
        <label htmlFor="outPhone">Telepon</label>
        <input
          id="outPhone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Opsional"
        />
      </div>

      {!value && (
        <p className="field-hint">
          Outlet baru dimulai dengan stok kosong. Isi lewat Pembelian atau opname di halaman Produk
          setelah berpindah ke outlet ini.
        </p>
      )}
    </Drawer>
  )
}
