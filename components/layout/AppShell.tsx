import type { SessionContext } from '@/lib/auth'
import { visibleNav } from '@/lib/navigation'
import { BottomNav } from './BottomNav'
import { ImpersonationBanner } from './ImpersonationBanner'
import { Sidebar } from './Sidebar'
import { SubscriptionBanner } from './SubscriptionBanner'
import { Topbar } from './Topbar'
import { subscriptionState } from '@/lib/subscription'

/**
 * Kerangka aplikasi.
 *
 * Berbeda dari wireframe, topbar TIDAK membentang penuh: kolom gelap berjalan
 * dari paling atas layar dan memuat brand di dalamnya. Di wireframe, panel
 * forest menggantung di bawah bar putih sehingga terbaca seperti tempelan;
 * dengan kolom penuh, gelapnya menjadi struktur halaman.
 *
 * Di mobile kolom itu hilang sama sekali dan brand pindah ke topbar, karena
 * navigasi ditangani bottom nav.
 */
export function AppShell({
  session,
  context,
  children,
}: {
  session: SessionContext
  /** Teks kecil di bawah nama brand — nama toko, atau nama platform. */
  context: string
  children: React.ReactNode
}) {
  const items = visibleNav(session.role, session.permissions)
  const subscription = subscriptionState(session.org)

  return (
    <div className="app">
      <Sidebar items={items} context={context} logoUrl={session.org?.logoUrl} />
      <div className="main-col">
        {session.impersonating && session.org && (
          <ImpersonationBanner storeName={session.org.name} />
        )}
        <Topbar
          context={context}
          initials={session.initials}
          outlets={session.outlets}
          activeOutletId={session.outletId}
          stores={session.organizations.map((o) => ({ id: o.id, name: o.name, city: o.city }))}
          activeStoreId={session.org?.id ?? null}
          storeName={session.org?.name ?? null}
          logoUrl={session.org?.logoUrl}
        />
        <SubscriptionBanner state={subscription} />
        <main className="content">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  )
}
