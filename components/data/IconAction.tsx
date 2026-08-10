'use client'

import { useState } from 'react'
import { Icon, type IconName } from '@/components/ui/icons'
import { cn } from '@/lib/format'

/**
 * Tombol ikon di dalam baris tabel.
 *
 * `confirm` mengubahnya jadi dua langkah: klik pertama meminta penegasan di
 * tempat, klik kedua menjalankan. Dipilih ketimbang dialog `window.confirm`
 * karena dialog bawaan browser memblokir seluruh halaman dan tampilannya di
 * luar kendali tema.
 */
export function IconAction({
  icon,
  label,
  onClick,
  danger = false,
  confirm = false,
  disabled = false,
}: {
  icon: IconName
  label: string
  onClick: () => void
  danger?: boolean
  confirm?: boolean
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)

  if (armed) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-sm"
          style={{ background: 'var(--color-coral)', color: '#fff' }}
          onClick={() => {
            setArmed(false)
            onClick()
          }}
        >
          Ya, {label.toLowerCase()}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>
          Batal
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cn('icon-action', danger && 'danger')}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={() => (confirm ? setArmed(true) : onClick())}
    >
      <Icon name={icon} size={15} />
    </button>
  )
}
