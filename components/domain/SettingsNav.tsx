'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { Route } from 'next'
import { cn } from '@/lib/format'

const TABS: { href: Route; label: string; ownerOnly?: boolean }[] = [
  { href: '/pengaturan/toko', label: 'Toko' },
  { href: '/pengaturan/outlet', label: 'Outlet' },
  { href: '/pengaturan/tim', label: 'Tim & Akses', ownerOnly: true },
  { href: '/pengaturan/kategori', label: 'Kategori' },
  { href: '/pengaturan/printer', label: 'Struk & Printer' },
  { href: '/pengaturan/sinkronisasi', label: 'Sinkronisasi' },
]

export function SettingsNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname()
  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner)
  const activeRef = useRef<HTMLAnchorElement>(null)

  /**
   * Di layar sempit barisnya digeser, dan tab yang sedang aktif bisa jatuh di
   * luar layar — orang mendarat di halaman Sinkronisasi tanpa melihat tab mana
   * yang menyala, jadi tidak ada penanda sedang berada di mana.
   *
   * Gulirnya INSTAN. `behavior: 'smooth'` sudah pernah diabaikan diam-diam di
   * project ini tanpa error sama sekali; yang instan selalu bekerja.
   */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav className="tabs" aria-label="Bagian pengaturan">
      {tabs.map((t) => {
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
