'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { savePlatformSettings } from '@/app/(platform)/admin/actions'
import type { AdminResult } from '@/app/(platform)/admin/actions'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-dark" type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan Perubahan'}
    </button>
  )
}

export type PlatformSettings = {
  platformName: string
  brandTagline: string
  supportEmail: string
  supportPhone: string
  defaultTimezone: string
  trialDays: number
}

/**
 * Pengaturan platform, akhirnya bisa disimpan.
 *
 * Seluruh isian terkendali state: React 19 me-reset `<form>` setelah aksinya
 * selesai, jadi `defaultValue` akan hilang tiap kali validasi gagal dan admin
 * harus mengetik ulang enam kotak karena satu email salah ketik.
 */
export function PlatformSettingsForm({ value }: { value: PlatformSettings }) {
  const [state, action] = useActionState<AdminResult | null, FormData>(
    savePlatformSettings,
    null,
  )
  const [v, setV] = useState(value)
  const set = <K extends keyof PlatformSettings>(k: K, x: PlatformSettings[K]) =>
    setV((p) => ({ ...p, [k]: x }))

  return (
    <form action={action} className="card form-narrow">
      <div className="field">
        <label htmlFor="platformName">Nama Platform</label>
        <input
          id="platformName"
          name="platformName"
          value={v.platformName}
          onChange={(e) => set('platformName', e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="brandTagline">Tagline Brand</label>
        <input
          id="brandTagline"
          name="brandTagline"
          value={v.brandTagline}
          onChange={(e) => set('brandTagline', e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="supportEmail">Email Support</label>
          <input
            id="supportEmail"
            name="supportEmail"
            type="email"
            value={v.supportEmail}
            onChange={(e) => set('supportEmail', e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="supportPhone">WhatsApp Support</label>
          <input
            id="supportPhone"
            name="supportPhone"
            value={v.supportPhone}
            onChange={(e) => set('supportPhone', e.target.value)}
            placeholder="Mis. 0812 3456 7890"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="defaultTimezone">Zona Waktu Bawaan</label>
          <input
            id="defaultTimezone"
            name="defaultTimezone"
            value={v.defaultTimezone}
            onChange={(e) => set('defaultTimezone', e.target.value)}
            required
          />
          <div className="field-hint">Dipakai toko baru yang belum mengatur sendiri.</div>
        </div>
        <div className="field">
          <label htmlFor="trialDays">Masa Coba Gratis (hari)</label>
          <input
            id="trialDays"
            name="trialDays"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            value={v.trialDays}
            onChange={(e) => set('trialDays', Number(e.target.value) || 0)}
            required
          />
          {/* Angka ini menentukan penawaran komersial platform, jadi akibatnya
              harus disebut di layar. Toko yang SUDAH terdaftar tidak ikut
              berubah: masa cobanya sudah dipatok saat pendaftaran. */}
          <div className="field-hint">
            Berlaku untuk toko yang mendaftar setelah ini. Toko lama tidak berubah.
          </div>
        </div>
      </div>

      {state && (
        <div
          className={cn('empty-note', state.ok && 'is-ok')}
          style={{ marginBottom: 14 }}
          role={state.ok ? 'status' : 'alert'}
        >
          <Icon name={state.ok ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{state.ok ? state.message : state.error}</div>
        </div>
      )}

      <Submit />
    </form>
  )
}
