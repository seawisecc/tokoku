import type { Route } from 'next'
import { SectionTabs } from '@/components/layout/SectionTabs'

/**
 * Tab bagian Laporan.
 *
 * Laporan Shift dulu cuma tautan kecil di pojok kanan atas dan tidak menyalakan
 * apa pun saat dibuka. Laporan Shift SENGAJA tidak ikut gerbang paket: selisih
 * kas itu pengamanan uang, bukan analisa.
 *
 * Pengeluaran adalah satu-satunya tab di sini yang isinya PENCATATAN, bukan
 * laporan, dan itu disengaja. Ia butuh izin `reports` — izin "boleh menyentuh
 * uang" di aplikasi ini, yang sama dengan pembatalan transaksi — sementara
 * menu Pembelian yang bentuknya paling mirip justru dijaga izin `products`.
 * Ditaruh di sana, anggota yang memegang laporan tanpa memegang produk tidak
 * punya jalan sama sekali ke halaman yang secara aturan boleh ia pakai, persis
 * celah yang dulu terjadi pada Transfer Stok. Di bawah Laporan, izin menunya
 * dan izin halamannya tidak pernah bisa berbeda.
 *
 * Tab Keuangan SELALU ditampilkan, termasuk untuk paket yang belum
 * membukanya — beda dengan tab Konsinyasi yang disembunyikan di
 * `PembelianTabs`. Bedanya: halaman Konsinyasi MEMANTULKAN orang kembali ke
 * `/pembelian`, jadi tabnya akan terbaca seperti tombol rusak. Halaman
 * Keuangan tetap terbuka dan menjelaskan apa yang ada di dalamnya lewat
 * `PlanLock`, dan itu justru gunanya: yang tidak pernah melihat isinya tidak
 * akan pernah terpikir menaikkan paketnya.
 */
export function LaporanTabs() {
  return (
    <SectionTabs
      label="Bagian laporan"
      items={[
        { href: '/laporan' as Route, label: 'Penjualan' },
        { href: '/laporan/shift' as Route, label: 'Laporan Shift' },
        { href: '/laporan/pengeluaran' as Route, label: 'Pengeluaran' },
        { href: '/laporan/keuangan' as Route, label: 'Keuangan' },
      ]}
    />
  )
}
