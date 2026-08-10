'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { finishRegistration, type FinishState } from '@/app/(auth)/daftar-toko/actions'
import { signOut } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? 'Menyiapkan toko…' : label}
    </button>
  )
}

export function FinishRegistration({
  defaultName,
  defaultCity,
  submitLabel = 'Buat Toko',
  showSignOut = true,
}: {
  defaultName: string
  defaultCity: string
  submitLabel?: string
  /** Hanya untuk akun yang belum punya toko — lihat catatan di bawah. */
  showSignOut?: boolean
}) {
  // Terkendali state: React 19 me-reset form setelah action selesai.
  const [name, setName] = useState(defaultName)
  const [city, setCity] = useState(defaultCity)
  const [state, action] = useActionState<FinishState, FormData>(finishRegistration, {})

  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="storeName">Nama Toko</label>
          <input
            id="storeName"
            name="storeName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Toko Dewi"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="city">Kota</label>
          <input
            id="city"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Denpasar"
          />
        </div>

        {state.error && (
          <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{state.error}</div>
          </div>
        )}

        <Submit label={submitLabel} />
      </form>

      {/* "Keluar" hanya masuk akal saat akunnya memang belum punya toko dan
          terjebak di layar ini. Bagi yang sedang menambah toko kedua, tombol
          keluar di tengah borang adalah jebakan — halaman ini punya tautan
          "Kembali" sendiri. */}
      {showSignOut && (
        <form action={signOut}>
          <button className="btn btn-ghost btn-block" type="submit" style={{ marginTop: 10 }}>
            Keluar
          </button>
        </form>
      )}
    </>
  )
}
