'use client'

import { useState } from 'react'
import { saveStore } from '@/app/(toko)/pengaturan/actions'
import { rupiah } from '@/lib/format'
import { SettingsForm, ToggleRow } from './SettingsForm'

export type StoreValues = {
  name: string
  city: string
  address: string
  phone: string
  email: string
  lowStockThreshold: number
  allowNegativeStock: boolean
  loyaltyEnabled: boolean
  loyaltyEarnPer: number
  loyaltyPointValue: number
  maxManualDiscountPercent: number
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
          name="loyaltyEnabled"
          label="Kumpulkan poin loyalty"
          hint="Poin bertambah otomatis tiap transaksi lunas, dan kembali kalau transaksinya dibatalkan. Matikan kalau toko tidak memakai program poin."
          defaultChecked={v.loyaltyEnabled}
          onToggle={(b) => set('loyaltyEnabled', b)}
        />

        {v.loyaltyEnabled && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="loyaltyEarnPer">Belanja per 1 poin</label>
              <input
                id="loyaltyEarnPer"
                name="loyaltyEarnPer"
                inputMode="numeric"
                value={v.loyaltyEarnPer}
                onChange={(e) =>
                  set('loyaltyEarnPer', Number(e.target.value.replace(/[^\d]/g, '') || 0))
                }
              />
              <div className="field-hint">
                Belanja {rupiah(v.loyaltyEarnPer)} dapat 1 poin. Pembulatan ke bawah.
              </div>
            </div>
            <div className="field">
              <label htmlFor="loyaltyPointValue">Nilai 1 poin</label>
              <input
                id="loyaltyPointValue"
                name="loyaltyPointValue"
                inputMode="numeric"
                value={v.loyaltyPointValue}
                onChange={(e) =>
                  set('loyaltyPointValue', Number(e.target.value.replace(/[^\d]/g, '') || 0))
                }
              />
              <div className="field-hint">
                1 poin dipotong {rupiah(v.loyaltyPointValue)} saat ditukar.
              </div>
            </div>
          </div>
        )}

        {/* Batas diskon kasir. Bawaannya 0 = mati, dan itu disengaja: diskon
            yang lupa dibatasi mengeluarkan uang diam-diam, tanpa meninggalkan
            selisih kas. Lihat kepala migrasi 0042. */}
        <div className="field">
          <label htmlFor="maxManualDiscountPercent">Batas diskon kasir (%)</label>
          <input
            id="maxManualDiscountPercent"
            name="maxManualDiscountPercent"
            type="number"
            min={0}
            max={100}
            value={v.maxManualDiscountPercent}
            onChange={(e) =>
              set('maxManualDiscountPercent', Math.min(Math.max(Number(e.target.value) || 0, 0), 100))
            }
          />
          <div className="field-hint">
            {v.maxManualDiscountPercent === 0
              ? 'Nol berarti kasir tidak bisa memberi diskon sama sekali. Tombolnya tidak muncul di layar bayar.'
              : `Kasir boleh memberi diskon sampai ${v.maxManualDiscountPercent}% dari total belanja, dan wajib menuliskan alasannya. Batas ini ditegakkan di server, jadi tidak bisa dilewati dari perangkat.`}
          </div>
        </div>

        <ToggleRow
          name="allowNegativeStock"
          label="Izinkan stok minus saat penjualan online"
          hint="Penjualan offline selalu diterima apa pun keadaan stok. Barangnya sudah keluar dari rak. Sakelar ini hanya mengatur penjualan saat kasir terhubung internet."
          defaultChecked={v.allowNegativeStock}
        />
      </SettingsForm>
    </div>
  )
}
