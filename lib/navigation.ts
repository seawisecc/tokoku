import type { Route } from 'next'
import type { IconName } from '@/components/ui/icons'

/**
 * Konfigurasi navigasi.
 *
 * Bedanya dengan wireframe: di sana role dipilih lewat role-switch demo, dan
 * tiap role punya daftar menu tetap. Di sini SEMUA role di dalam toko berbagi
 * satu daftar yang sama, lalu disaring oleh izin modul.
 *
 * Alasannya konkret: dulu daftar kasir dipatok tiga menu, sehingga pemilik bisa
 * memberi kasir izin "Laporan" tanpa menu itu pernah muncul — izinnya aktif di
 * database dan halamannya bisa dibuka lewat URL, tapi tidak ada jalan ke sana.
 * Sakelar izin harus benar-benar menentukan apa yang terlihat.
 */
export type AppRole = 'platform_admin' | 'owner' | 'admin' | 'cashier'
export type Permission = 'pos' | 'products' | 'reports' | 'settings'

export type NavItem = {
  id: string
  label: string
  href: Route
  icon: IconName
  fab?: boolean
  /**
   * Awalan path yang ikut menyalakan menu ini, kalau `href` saja tidak cukup.
   *
   * Dibutuhkan menu yang `href`-nya menunjuk salah satu ANAK, bukan pangkalnya.
   * Pengaturan mengarah ke `/pengaturan/toko` karena `/pengaturan` sendiri
   * bukan halaman — akibatnya, begitu orang berpindah ke tab Kategori,
   * `/pengaturan/kategori` bukan anak dari `/pengaturan/toko` dan menunya
   * padam di sidebar maupun bottom nav. Orang jadi kehilangan jejak sedang
   * berada di bagian mana aplikasi.
   */
  section?: string
  /** Menu muncul hanya kalau user punya salah satu izin ini. */
  requires?: Permission[]
  /** Menu disembunyikan kalau user punya izin ini — untuk menu yang sudah
   *  tercakup oleh menu lain yang lebih lengkap. */
  supersededBy?: Permission
}

export type NavConfig = {
  label: string
  items: NavItem[]
  home: Route
}

const TOKO_ITEMS: NavItem[] = [
  { id: 'beranda', label: 'Beranda', href: '/beranda', icon: 'grid', requires: ['reports'] },
  { id: 'transaksi', label: 'Transaksi', href: '/transaksi', icon: 'clock', requires: ['reports'] },
  // Riwayat = transaksi milik sendiri. Bagi yang punya akses laporan, menu
  // Transaksi sudah mencakupnya — tidak perlu tampil dua-duanya.
  {
    id: 'riwayat',
    label: 'Riwayat',
    href: '/riwayat',
    icon: 'clock',
    requires: ['pos'],
    supersededBy: 'reports',
  },
  { id: 'kasir', label: 'Kasir', href: '/kasir', icon: 'cart', fab: true, requires: ['pos'] },
  { id: 'produk', label: 'Produk', href: '/produk', icon: 'box', requires: ['products'] },
  {
    id: 'pembelian',
    label: 'Pembelian',
    href: '/pembelian',
    icon: 'layers',
    requires: ['products'],
  },
  { id: 'laporan', label: 'Laporan', href: '/laporan', icon: 'chart', requires: ['reports'] },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    href: '/pengaturan/toko',
    icon: 'sliders',
    section: '/pengaturan',
    requires: ['settings'],
  },
  { id: 'profil', label: 'Profil', href: '/profil', icon: 'user' },
]

export const NAV: Record<AppRole, NavConfig> = {
  platform_admin: {
    label: 'Super Admin',
    home: '/admin',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'grid' },
      { id: 'klien', label: 'Klien', href: '/admin/klien', icon: 'users' },
      { id: 'paket', label: 'Paket', href: '/admin/paket', icon: 'card' },
      { id: 'pengaturan', label: 'Pengaturan', href: '/admin/pengaturan', icon: 'sliders' },
    ],
  },
  owner: { label: 'Pemilik Toko', home: '/beranda', items: TOKO_ITEMS },
  admin: { label: 'Admin Toko', home: '/beranda', items: TOKO_ITEMS },
  cashier: { label: 'Kasir', home: '/kasir', items: TOKO_ITEMS },
}

/** Menu yang benar-benar boleh dilihat user ini. */
export function visibleNav(role: AppRole, permissions: Record<string, boolean>): NavItem[] {
  const cfg = NAV[role]
  if (role === 'platform_admin') return cfg.items

  return cfg.items.filter((item) => {
    if (item.supersededBy && permissions[item.supersededBy] === true) return false
    if (!item.requires) return true
    return item.requires.some((p) => permissions[p] === true)
  })
}

/** Berapa banyak menu yang muat di bottom nav sebuah ponsel. */
const SLOT_MOBILE = 5

/**
 * Pembagian menu untuk bottom nav.
 *
 * Layar 390px hanya muat lima tujuan; pemilik toko punya tujuh. Dipaksakan
 * semua, labelnya saling menempel dan menu terakhir terpotong di tepi kanan.
 *
 * Yang dipotong adalah TAMPILANNYA, bukan daftarnya: sisanya masuk ke lembar
 * "Lainnya" sehingga setiap menu yang diizinkan tetap punya jalan. Ini penting —
 * izin modul harus benar-benar menentukan apa yang bisa dicapai, dan menu yang
 * hilang dari layar sempit adalah kesalahan yang sama dengan daftar per-peran
 * yang sudah dibuang di atas.
 *
 * Urutan asli dipertahankan, jadi menu Kasir yang ber-FAB jatuh di tengah untuk
 * susunan menu yang lazim dipakai kasir dan pemilik.
 */
export function splitBottomNav(items: NavItem[]): { slots: NavItem[]; overflow: NavItem[] } {
  if (items.length <= SLOT_MOBILE) return { slots: items, overflow: [] }
  // Satu slot terakhir dipakai tombol "Lainnya", jadi yang tampil langsung
  // tinggal SLOT_MOBILE - 1.
  return { slots: items.slice(0, SLOT_MOBILE - 1), overflow: items.slice(SLOT_MOBILE - 1) }
}

/** Halaman awal setelah login — menu utama role ini kalau boleh, kalau tidak menu pertama. */
export function homeFor(role: AppRole, permissions: Record<string, boolean>): Route {
  const items = visibleNav(role, permissions)
  const preferred = items.find((i) => i.href === NAV[role].home)
  return (preferred ?? items[0])?.href ?? '/profil'
}
