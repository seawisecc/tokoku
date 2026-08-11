'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import { BrandLogo } from './BrandMark'
import type { NavItem } from '@/lib/navigation'
import { cn } from '@/lib/format'
import { isNavItemActive } from './isActivePath'

/**
 * Kolom navigasi. Memuat brand di puncaknya supaya panel gelap membentang
 * dari tepi atas layar — lihat catatan di AppShell.
 */
export function Sidebar({
  items,
  context,
  logoUrl,
}: {
  items: NavItem[]
  context: string
  logoUrl?: string | null
}) {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandLogo logoUrl={logoUrl} />
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
            className={cn('nav-item', isNavItemActive(pathname, item) && 'active')}
            aria-current={isNavItemActive(pathname, item) ? 'page' : undefined}
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
