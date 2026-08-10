import { PageSkeleton } from '@/components/layout/PageSkeleton'

/**
 * Pengaturan punya batasnya sendiri supaya `SettingsNav` tetap terpasang saat
 * berpindah antar sub-halaman. Tanpa ini yang dipakai adalah batas milik grup
 * toko satu tingkat di atas, dan tab pengaturannya ikut hilang setiap kali
 * ditekan — persis navigasi yang sedang dipakai orang itu.
 *
 * Tanpa hero: tidak ada satu pun halaman pengaturan yang punya blok besar itu.
 */
export default function Loading() {
  return <PageSkeleton hero={false} />
}
