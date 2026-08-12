import type { Route } from 'next'
import { SectionTabs } from '@/components/layout/SectionTabs'

/**
 * Tab bagian Pembelian.
 *
 * Konsinyasi hanya muncul di paket `purchasing = 'full'` — halamannya sendiri
 * memang mengalihkan ke `/pembelian` kalau paketnya tidak cukup, tapi tab yang
 * tetap terlihat lalu memantulkan orang kembali terbaca seperti tombol rusak.
 * Kalau tinggal satu tab, `SectionTabs` tidak menggambar apa pun.
 */
export function PembelianTabs({ full }: { full: boolean }) {
  return (
    <SectionTabs
      label="Bagian pembelian"
      items={[
        { href: '/pembelian' as Route, label: 'Pembelian' },
        ...(full ? [{ href: '/pembelian/konsinyasi' as Route, label: 'Konsinyasi' }] : []),
      ]}
    />
  )
}
