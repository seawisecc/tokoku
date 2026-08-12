import type { Route } from 'next'
import { SectionTabs } from '@/components/layout/SectionTabs'

/**
 * Tab bagian Laporan.
 *
 * Laporan Shift dulu cuma tautan kecil di pojok kanan atas dan tidak menyalakan
 * apa pun saat dibuka. Laporan Shift SENGAJA tidak ikut gerbang paket: selisih
 * kas itu pengamanan uang, bukan analisa.
 */
export function LaporanTabs() {
  return (
    <SectionTabs
      label="Bagian laporan"
      items={[
        { href: '/laporan' as Route, label: 'Penjualan' },
        { href: '/laporan/shift' as Route, label: 'Laporan Shift' },
      ]}
    />
  )
}
