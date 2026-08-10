import { requirePermission } from '@/lib/auth'
import { SettingsNav } from '@/components/domain/SettingsNav'

/**
 * Semua halaman pengaturan butuh izin modul `settings`. Dijaga di satu tempat
 * supaya tidak ada sub-halaman yang lupa memasang penjaganya.
 */
export default async function PengaturanLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePermission('settings')

  return (
    <>
      <SettingsNav isOwner={session.role === 'owner'} />
      {children}
    </>
  )
}
