'use client'

import { useEffect } from 'react'
import { Icon } from '@/components/ui/icons'

/**
 * Panel geser dari kanan — pola yang dipakai wireframe untuk semua form.
 *
 * Dirender hanya saat terbuka. Escape dan klik latar menutupnya, dan selama
 * terbuka `body` dikunci agar halaman di belakangnya tidak ikut ter-scroll —
 * di HP, tanpa itu, menggulir isi form justru menggeser daftar di belakangnya.
 */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <aside className="drawer show" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
            {subtitle && <div className="cell-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  )
}
