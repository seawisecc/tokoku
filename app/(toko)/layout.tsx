import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { ServiceWorkerRegistrar } from '@/components/pos/ServiceWorkerRegistrar'
import { requireSession } from '@/lib/auth'

/**
 * Lapisan penjaga kedua (setelah proxy, sebelum RLS): pastikan user sudah
 * login DAN benar-benar anggota sebuah toko. Super Admin dilempar ke area
 * platform — dia tidak punya toko sendiri.
 */
export default async function TokoLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  // Super Admin yang sedang melihat toko klien punya role 'owner' + flag
  // impersonating, jadi lolos di sini. Yang tanpa toko tetap dilempar balik.
  if (session.role === 'platform_admin') redirect('/admin')
  if (!session.org) redirect('/masuk')

  const context = [session.org.name, session.org.city].filter(Boolean).join(' · ')

  return (
    <AppShell session={session} context={context}>
      <ServiceWorkerRegistrar />
      {children}
    </AppShell>
  )
}
