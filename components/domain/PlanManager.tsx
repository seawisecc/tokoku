'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePlan } from '@/app/(platform)/admin/actions'
import { IconAction } from '@/components/data/IconAction'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'

export type PlanRow = {
  id: string
  code: string
  name: string
  description: string | null
  priceMonthly: number
  maxOutlets: number | null
  maxUsers: number | null
  maxProducts: number | null
  maxDevices: number | null
  isActive: boolean
  clientCount: number
}

const empty = (): PlanRow => ({
  id: '',
  code: '',
  name: '',
  description: '',
  priceMonthly: 0,
  maxOutlets: null,
  maxUsers: null,
  maxProducts: null,
  maxDevices: null,
  isActive: true,
  clientCount: 0,
})

const limitLabel = (n: number | null) => (n === null ? 'Tak terbatas' : String(n))

export function PlanManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<PlanRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink-soft)' }}>
            {plans.length} paket
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setEditing(empty())}>
            <Icon name="plus" size={15} /> Tambah Paket
          </button>
        </div>

        {notice && (
          <div className="empty-note" style={{ margin: '14px 16px' }} role="alert">
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{notice}</div>
          </div>
        )}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Paket</th>
                <th>Harga / bln</th>
                <th>Outlet</th>
                <th>User</th>
                <th>Produk</th>
                <th>Perangkat</th>
                <th>Klien</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-name">{p.name}</div>
                    <div className="cell-sub mono">{p.code}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{rupiah(p.priceMonthly)}</td>
                  <td>{limitLabel(p.maxOutlets)}</td>
                  <td>{limitLabel(p.maxUsers)}</td>
                  <td>{limitLabel(p.maxProducts)}</td>
                  <td>{limitLabel(p.maxDevices)}</td>
                  <td>
                    <span className={cn('badge', p.clientCount > 0 ? 'badge-growth' : 'badge-ok')}>
                      {p.clientCount}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {!p.isActive && <span className="badge badge-inactive">Nonaktif</span>}
                      <IconAction icon="edit" label="Edit" onClick={() => setEditing(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PlanDrawer
          key={editing.id || 'baru'}
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setNotice(null)
            router.refresh()
          }}
          onError={setNotice}
        />
      )}
    </>
  )
}

function PlanDrawer({
  plan,
  onClose,
  onSaved,
  onError,
}: {
  plan: PlanRow
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  // Terkendali state — React 19 me-reset form ber-`action` setelah selesai.
  const [v, setV] = useState({
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    priceMonthly: String(plan.priceMonthly),
    maxOutlets: plan.maxOutlets === null ? '' : String(plan.maxOutlets),
    maxUsers: plan.maxUsers === null ? '' : String(plan.maxUsers),
    maxProducts: plan.maxProducts === null ? '' : String(plan.maxProducts),
    maxDevices: plan.maxDevices === null ? '' : String(plan.maxDevices),
    isActive: plan.isActive,
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const set = (k: keyof typeof v, val: string | boolean) => setV((s) => ({ ...s, [k]: val }))

  function submit() {
    const fd = new FormData()
    fd.set('code', v.code)
    fd.set('name', v.name)
    fd.set('description', v.description)
    fd.set('priceMonthly', v.priceMonthly)
    fd.set('maxOutlets', v.maxOutlets)
    fd.set('maxUsers', v.maxUsers)
    fd.set('maxProducts', v.maxProducts)
    fd.set('maxDevices', v.maxDevices)
    if (v.isActive) fd.set('isActive', 'on')

    startTransition(async () => {
      const res = await savePlan(plan.id || null, fd)
      if (!res.ok) {
        setError(res.error)
        onError(res.error)
        return
      }
      onSaved()
    })
  }

  return (
    <Drawer
      open
      title={plan.id ? 'Edit Paket' : 'Tambah Paket'}
      subtitle={plan.id ? plan.code : 'Paket baru'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn-dark"
            type="button"
            disabled={pending}
            onClick={submit}
          >
            {pending ? 'Menyimpan…' : 'Simpan Paket'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor="planName">Nama Paket</label>
          <input id="planName" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Growth" />
        </div>
        <div className="field">
          <label htmlFor="planCode">Kode</label>
          <input
            id="planCode"
            value={v.code}
            onChange={(e) => set('code', e.target.value.toLowerCase())}
            placeholder="growth"
            disabled={Boolean(plan.id)}
          />
          {plan.id && <div className="field-hint">Kode tidak bisa diubah setelah dipakai.</div>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="planDesc">Deskripsi</label>
        <input
          id="planDesc"
          value={v.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Untuk toko berkembang dengan beberapa cabang"
        />
      </div>

      <div className="field">
        <label htmlFor="planPrice">Harga per Bulan</label>
        <input
          id="planPrice"
          inputMode="numeric"
          value={v.priceMonthly}
          onChange={(e) => set('priceMonthly', e.target.value.replace(/[^\d]/g, ''))}
        />
        <div className="field-hint">{rupiah(Number(v.priceMonthly || 0))}</div>
      </div>

      <div className="section-title">Batasan</div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="maxOutlets">Outlet</label>
          <input id="maxOutlets" inputMode="numeric" value={v.maxOutlets} onChange={(e) => set('maxOutlets', e.target.value.replace(/[^\d]/g, ''))} placeholder="kosong = tak terbatas" />
        </div>
        <div className="field">
          <label htmlFor="maxUsers">Pengguna</label>
          <input id="maxUsers" inputMode="numeric" value={v.maxUsers} onChange={(e) => set('maxUsers', e.target.value.replace(/[^\d]/g, ''))} placeholder="kosong = tak terbatas" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="maxProducts">Produk</label>
          <input id="maxProducts" inputMode="numeric" value={v.maxProducts} onChange={(e) => set('maxProducts', e.target.value.replace(/[^\d]/g, ''))} placeholder="kosong = tak terbatas" />
        </div>
        <div className="field">
          <label htmlFor="maxDevices">Perangkat Kasir</label>
          <input id="maxDevices" inputMode="numeric" value={v.maxDevices} onChange={(e) => set('maxDevices', e.target.value.replace(/[^\d]/g, ''))} placeholder="kosong = tak terbatas" />
        </div>
      </div>
      <div className="field-hint" style={{ marginTop: -6, marginBottom: 14 }}>
        Kosongkan untuk tanpa batas, disimpan sebagai NULL, bukan 0. Batas ini ditegakkan di
        database dan langsung berlaku untuk semua klien di paket ini.
      </div>

      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: 'pointer' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Paket aktif</span>
        <input type="checkbox" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />
      </label>
      <div className="field-hint" style={{ marginBottom: 14 }}>
        Paket nonaktif tidak muncul saat memilih paket klien.
      </div>

      {error && (
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}
    </Drawer>
  )
}
