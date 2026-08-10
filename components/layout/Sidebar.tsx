'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import type { NavItem } from '@/lib/navigation'
import { cn } from '@/lib/format'
import { isActivePath } from './isActivePath'

/**
 * Kolom navigasi. Memuat brand di puncaknya supaya panel gelap membentang
 * dari tepi atas layar — lihat catatan di AppShell.
 */
export function Sidebar({ items, context }: { items: NavItem[]; context: string }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">T</div>
        <div className="sidebar-brand-text">
          TokoKu
          <small>{context}</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navigasi utama">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn('nav-item', isActivePath(pathname, item.href) && 'active')}
            aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="nav-label">by Seawise Studio</span>
      </div>
    </aside>
  )
}
