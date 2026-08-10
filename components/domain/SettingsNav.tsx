'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn('btn', 'btn-sm', pathname === t.href ? 'btn-dark' : 'btn-ghost')}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
