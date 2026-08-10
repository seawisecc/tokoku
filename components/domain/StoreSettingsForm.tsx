'use client'

import { useState } from 'react'
import { saveStore } from '@/app/(toko)/pengaturan/actions'
import { SettingsForm, ToggleRow } from './SettingsForm'

export type StoreValues = {
  name: string
  city: string
  address: string
  phone: string
  email: string
  lowStockThreshold: number
  allowNegativeStock: boolean
}

export function StoreSettingsForm({ initial }: { initial: StoreValues }) {
  const [v, setV] = useState(initial)
  const set = <K extends keyof StoreValues>(k: K, val: StoreValues[K]) =>
    setV((s) => ({ ...s, [k]: val }))

  return (
    <div className="card form-narrow">
      <SettingsForm action={saveStore}>
        <div className="field">
          <label htmlFor="name">Nama Toko</label>
          <input id="name" name="name" value={v.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="city">Kota</label>
            <input id="city" name="city" value={v.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Telepon</label>
            <input id="phone" name="phone" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">Alamat</label>
          <input
            id="address"
            name="address"
            value={v.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Dicetak di struk"
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="lowStockThreshold">Ambang Stok Menipis (bawaan)</label>
          <input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            value={v.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', Number(e.target.value))}
          />
          <div className="field-hint">
            Dipakai untuk produk baru. Tiap produk bisa punya ambangnya sendiri.
          </div>
        </div>

        <ToggleRow
          name="allowNegativeStock"
          label="Izinkan stok minus saat penjualan online"
          hint="Penjualan offline selalu diterima apa pun keadaan stok — barangnya sudah keluar dari rak. Sakelar ini hanya mengatur penjualan saat kasir terhubung internet."
          defaultChecked={v.allowNegativeStock}
        />
      </SettingsForm>
    </div>
  )
}
