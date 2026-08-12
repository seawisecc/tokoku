/**
 * Halaman ini memakai kartu yang sama dengan halaman utama.
 *
 * Diteruskan lewat konvensi berkas, bukan dengan menulis URL gambarnya tangan
 * di `metadata.openGraph.images`: begitu sebuah halaman menimpa `openGraph`
 * untuk mengganti judulnya, Next mengganti SELURUH objek itu termasuk
 * gambarnya, dan kartunya muncul tanpa gambar tanpa ada yang menyadarinya.
 */
export { default, size, contentType, alt } from '../opengraph-image'
