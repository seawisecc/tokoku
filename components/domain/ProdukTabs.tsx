import type { Route } from 'next'
import { SectionTabs } from '@/components/layout/SectionTabs'

/**
 * Tab bagian Produk.
 *
 * Sengaja TIDAK dipasang lewat layout: `/produk/[id]` (kartu stok) juga tinggal
 * di bawah rute ini, dan di sana tidak ada tab yang cocok untuk menyala. Baris
 * tab dengan nol tab aktif persis cacat yang sudah pernah dilaporkan di
 * Pengaturan — orang kehilangan jejak sedang berada di bagian mana.
 */
export function ProdukTabs() {
  return (
    <SectionTabs
      label="Bagian produk"
      items={[
        { href: '/produk' as Route, label: 'Daftar Produk' },
        { href: '/produk/opname' as Route, label: 'Opname Stok' },
        { href: '/produk/transfer' as Route, label: 'Transfer Stok' },
      ]}
    />
  )
}
