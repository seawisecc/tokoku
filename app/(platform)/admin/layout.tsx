import { AppShell } from '@/components/layout/AppShell'
import { requirePlatformAdmin } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdmin()
  return (
    <AppShell session={session} context="Platform TokoKu">
      {children}
    </AppShell>
  )
}
