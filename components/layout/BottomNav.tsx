'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import type { NavItem } from '@/lib/navigation'
import { splitBottomNav } from '@/lib/navigation'
import { cn } from '@/lib/format'
import { isActivePath } from './isActivePath'

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const [sheet, setSheet] = useState(false)
  const { slots, overflow } = splitBottomNav(items)

  // Lembar harus tertutup sendiri setelah pindah halaman — kalau tidak, ia
  // masih menutupi halaman tujuan begitu Link selesai bekerja.
  useEffect(() => {
    setSheet(false)
  }, [pathname])

  const overflowActive = overflow.some((item) => isActivePath(pathname, item.href))

  return (
    <>
      <nav className="bottomnav" aria-label="Navigasi bawah">
        {slots.map((item) => (
          <BottomNavLink key={item.id} item={item} active={isActivePath(pathname, item.href)} />
        ))}

        {overflow.length > 0 && (
          <button
            type="button"
            className={cn('bnav-item', overflowActive && 'active')}
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-expanded={sheet}
          >
            <div className="dot" />
            <Icon name="more" size={20} />
            <span>Lainnya</span>
          </button>
        )}
      </nav>

      {sheet && overflow.length > 0 && (
        <>
          <div className="overlay show" onClick={() => setSheet(false)} />
          <div className="modal show" role="dialog" aria-label="Menu lainnya">
            <div className="modal-card nav-sheet">
              <div className="nav-sheet-head">
                <span>Menu Lainnya</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSheet(false)}
                  aria-label="Tutup"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              {overflow.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn('nav-sheet-item', isActivePath(pathname, item.href) && 'active')}
                  aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                  onClick={() => setSheet(false)}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn('bnav-item', item.fab && 'fab', active && 'active')}
      aria-current={active ? 'page' : undefined}
    >
      {item.fab ? (
        <div className="fab-circle">
          <Icon name={item.icon} size={22} />
        </div>
      ) : (
        <>
          <div className="dot" />
          <Icon name={item.icon} size={20} />
        </>
      )}
      <span>{item.label}</span>
    </Link>
  )
}
