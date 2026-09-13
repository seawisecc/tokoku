import type { SessionContext } from '@/lib/auth'
import { getNotifications } from '@/lib/notifications'
import { visibleNav } from '@/lib/navigation'
import { BottomNav } from './BottomNav'
import { ImpersonationBanner } from './ImpersonationBanner'
import { InstallPrompt } from './InstallPrompt'
import { Sidebar } from './Sidebar'
import { SubscriptionBanner } from './SubscriptionBanner'
import { Topbar } from './Topbar'
import { midtransConfigured } from '@/lib/midtrans'
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
export async function AppShell({
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
  /**
   * Tautan "bayar sekarang" di spanduk hanya untuk yang benar-benar bisa
   * membayar: pemilik atau admin toko, dan hanya kalau pembayaran online
   * memang dipasang. Gerbangnya sama persis dengan tombol di halaman Langganan
   * dan dengan `can_manage()` di dalam `create_subscription_invoice`.
   */
  const bisaBayarLangganan =
    midtransConfigured() &&
    session.permissions.settings &&
    (session.role === 'owner' || session.role === 'admin')
  // Dihitung di server, sekali per render halaman. Lihat catatan "tidak
  // dipoll" di NotificationBell.
  const notices = await getNotifications(session)

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
          notices={notices}
        />
        <SubscriptionBanner state={subscription} bisaBayar={bisaBayarLangganan} />
        {/* Sesudah spanduk langganan, bukan sebelumnya: langganan yang habis
            menghentikan penjualan hari ini, sementara ini cuma ajakan. */}
        <InstallPrompt />
        <main className="content">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  )
}
