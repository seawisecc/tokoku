/**
 * Nomor HP adalah kunci pelanggan yang sebenarnya di warung.
 *
 * Nama boleh kembar ("Bu Sri" ada tiga di satu kampung), tapi nomor HP tidak.
 * Karena itu nomor dinormalkan sebelum disimpan: 0812…, +62812…, dan 62812…
 * adalah orang yang sama, dan tanpa penyeragaman ini satu pelanggan bisa punya
 * tiga baris dengan poin yang terpecah tiga.
 *
 * Disimpan dalam bentuk internasional tanpa plus (62…) karena itu yang diminta
 * `wa.me`. Yang DITAMPILKAN tetap bentuk lokal lewat `hpLokal()`.
 */
export function normalkanHp(raw: string): string | null {
  const angka = raw.replace(/[^\d+]/g, '')
  if (!angka) return null
  let n = angka.replace(/^\+/, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (!n.startsWith('62')) n = '62' + n
  return n.length >= 9 ? n : null
}

/** Bentuk yang dibaca orang: 0812…, bukan 62812… */
export function hpLokal(n: string | null | undefined): string {
  if (!n) return '-'
  return n.startsWith('62') ? '0' + n.slice(2) : n
}
