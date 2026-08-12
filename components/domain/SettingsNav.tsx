import type { Route } from 'next'
import { SectionTabs, type SectionTab } from '@/components/layout/SectionTabs'

const TABS: (SectionTab & { ownerOnly?: boolean })[] = [
  { href: '/pengaturan/toko' as Route, label: 'Toko' },
  { href: '/pengaturan/outlet' as Route, label: 'Outlet' },
  { href: '/pengaturan/tim' as Route, label: 'Tim & Akses', ownerOnly: true },
  { href: '/pengaturan/kategori' as Route, label: 'Kategori' },
  { href: '/pengaturan/printer' as Route, label: 'Struk & Printer' },
  { href: '/pengaturan/sinkronisasi' as Route, label: 'Sinkronisasi' },
  // Sengaja paling kanan: yang dibuka sehari-hari ada di kiri, dan langganan
  // adalah hal yang dilihat sesekali — bukan tiap hari.
  { href: '/pengaturan/langganan' as Route, label: 'Langganan' },
]

/**
 * Tab Pengaturan. Perilakunya (tab aktif, gulir di layar sempit) tinggal di
 * `SectionTabs` supaya sama persis dengan bagian lain yang bercabang.
 */
export function SettingsNav({ isOwner }: { isOwner: boolean }) {
  return (
    <SectionTabs
      label="Bagian pengaturan"
      items={TABS.filter((t) => !t.ownerOnly || isOwner).map(({ href, label }) => ({ href, label }))}
    />
  )
}
