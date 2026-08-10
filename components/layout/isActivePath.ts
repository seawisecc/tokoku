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
