/**
 * Menu dianggap aktif kalau path saat ini sama persis atau merupakan anaknya
 * (mis. /produk tetap aktif saat berada di /produk/kategori).
 *
 * '/admin' dikecualikan dari pencocokan awalan: tanpa itu, menu Dashboard
 * akan ikut menyala saat berada di /admin/klien.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === '/admin') return false
  return pathname.startsWith(href + '/')
}

/**
 * Menu mana yang sedang menyala.
 *
 * Dipakai sidebar DAN bottom nav — keduanya harus sepakat, kalau tidak menu
 * yang sama terbaca aktif di satu tempat dan padam di tempat lain pada halaman
 * yang sama persis.
 *
 * `section` diperiksa lebih dulu supaya menu yang menunjuk salah satu anaknya
 * (Pengaturan → /pengaturan/toko) tetap menyala di seluruh sub-halamannya.
 */
export function isNavItemActive(
  pathname: string,
  item: { href: string; section?: string },
): boolean {
  if (item.section && (pathname === item.section || pathname.startsWith(item.section + '/'))) {
    return true
  }
  return isActivePath(pathname, item.href)
}
