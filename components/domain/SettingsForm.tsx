'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/ui/icons'
import type { Result } from '@/app/(toko)/pengaturan/actions'

/**
 * Pembungkus form pengaturan.
 *
 * Isian dipegang komponen anak (terkendali state), bukan `defaultValue`:
 * React 19 me-reset <form> setelah `action` selesai, jadi input tak terkendali
 * kehilangan isinya setiap kali validasi gagal.
 */
export function SettingsForm({
  action,
  children,
  submitLabel = 'Simpan Perubahan',
  onResult,
}: {
  action: (fd: FormData) => Promise<Result>
  children: React.ReactNode
  submitLabel?: string
  onResult?: (r: Result) => void
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const r = await action(fd)
          setResult(r)
          onResult?.(r)
        })
      }}
    >
      {children}

      {result && !result.ok && (
        <div className="empty-note" style={{ marginTop: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{result.error}</div>
        </div>
      )}
      {result?.ok && result.message && (
        <div
          className="empty-note"
          style={{ marginTop: 14, background: 'var(--color-success-soft)', color: 'var(--color-success)' }}
          role="status"
        >
          <Icon name="check" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{result.message}</div>
        </div>
      )}

      <button className="btn btn-dark" type="submit" disabled={pending} style={{ marginTop: 16 }}>
        {pending ? 'Menyimpan…' : submitLabel}
      </button>
    </form>
  )
}

/** Baris sakelar dengan penjelasan — dipakai di beberapa halaman pengaturan. */
export function ToggleRow({
  name,
  label,
  hint,
  defaultChecked,
  onToggle,
}: {
  name: string
  label: string
  hint?: string
  defaultChecked: boolean
  /**
   * Dipanggil tiap sakelar berubah, untuk pemanggil yang perlu ikut bereaksi
   * SEBELUM disimpan — mis. pratinjau struk yang harus langsung menunjukkan
   * hasilnya. Sakelarnya tetap memegang keadaannya sendiri; ini cuma salinan
   * keluar, jadi pemanggil lain tidak perlu berubah apa-apa.
   */
  onToggle?: (checked: boolean) => void
}) {
  const [on, setOn] = useState(defaultChecked)
  return (
    <label
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '12px 0',
        borderTop: '1px solid var(--color-line)',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {hint && <div className="field-hint">{hint}</div>}
      </div>
      <input
        type="checkbox"
        name={name}
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked)
          onToggle?.(e.target.checked)
        }}
        style={{ marginTop: 3 }}
      />
    </label>
  )
}
