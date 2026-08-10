import { PageSkeleton } from '@/components/layout/PageSkeleton'

/**
 * Batas Suspense untuk SELURUH area toko.
 *
 * Ditaruh di pangkal grup, bukan per halaman: AppShell (kolom navigasi, topbar,
 * bottom nav) ada di layout, jadi ia tetap terpasang dan hanya isinya yang
 * berganti kerangka. Menekan menu langsung mengubah layar — navigasinya ikut
 * menyala di menu yang baru — sementara servernya masih menyiapkan datanya.
 */
export default function Loading() {
  return <PageSkeleton />
}
