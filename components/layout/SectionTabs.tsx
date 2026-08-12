'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { Route } from 'next'
import { cn } from '@/lib/format'

export type SectionTab = { href: Route; label: string }

/**
 * Baris tab untuk satu bagian yang punya beberapa halaman.
 *
 * Dulu pola ini cuma ada di Pengaturan (`SettingsNav`), sementara bagian lain
 * yang sama-sama bercabang memakai tautan seadanya: Laporan menaruh "Laporan
 * Shift" sebagai tautan kecil di pojok kanan, Pembelian menaruh Konsinyasi
 * sebagai tombol, dan Transfer Stok cuma bisa dicapai dari halaman Outlet.
 * Tiga bentuk berbeda untuk satu hal yang sama, dan tidak satu pun dari yang
 * di luar Pengaturan memberi tahu orang sedang berada di sub-halaman mana.
 *
 * Ditulis satu kali di sini supaya perilakunya tidak bergeser per bagian.
 */
export function SectionTabs({ items, label }: { items: SectionTab[]; label: string }) {
  const pathname = usePathname()
  const activeRef = useRef<HTMLAnchorElement>(null)

  /**
   * Di layar sempit barisnya digeser, dan tab yang sedang aktif bisa jatuh di
   * luar layar sehingga orang mendarat tanpa melihat tab mana yang menyala.
   *
   * Gulirnya INSTAN. `behavior: 'smooth'` sudah pernah diabaikan diam-diam di
   * project ini tanpa error sama sekali; yang instan selalu bekerja.
   */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  if (items.length < 2) return null

  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            ref={active ? activeRef : undefined}
            className={cn('tab', active && 'active')}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
